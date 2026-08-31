"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireAdminUser, requireFullAdmin, ALL_PERMISSIONS, type Permission } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { encryptSecret, decryptSecret } from "@/lib/secret-crypto"
import { and, desc, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

const VALID_PERMS: Permission[] = ALL_PERMISSIONS

function sanitizePerms(input: unknown): Permission[] {
  if (!Array.isArray(input)) return []
  return input.filter((p): p is Permission => VALID_PERMS.includes(p as Permission))
}

export type ManagedUser = {
  id: string
  name: string
  username: string | null
  role: string | null
  permissions: Permission[]
  // Features the admin chose to show even without permission (locked view).
  visibleFeatures: Permission[]
  maintenance: boolean
  createdAt: string
  // Decrypted recoverable password for admin viewing. Null when it was never
  // captured (e.g. accounts created before this feature, until next change).
  password: string | null
}

export async function listUsers(): Promise<ManagedUser[]> {
  await requireFullAdmin()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      visibleFeatures: user.visibleFeatures,
      maintenance: user.maintenance,
      createdAt: user.createdAt,
      recoveryPassword: user.recoveryPassword,
    })
    .from(user)
    .orderBy(desc(user.createdAt))

  return rows.map((r) => {
    const perms = r.role === "admin" ? VALID_PERMS : sanitizePerms(safeParse(r.permissions))
    // Visible = granted permissions UNION explicitly-shown features.
    const visible =
      r.role === "admin"
        ? VALID_PERMS
        : Array.from(new Set<Permission>([...perms, ...sanitizePerms(safeParse(r.visibleFeatures))]))
    return {
      id: r.id,
      name: r.name,
      username: r.username,
      role: r.role,
      permissions: perms,
      visibleFeatures: visible,
      maintenance: Boolean(r.maintenance),
      createdAt: r.createdAt.toISOString(),
      password: decryptSecret(r.recoveryPassword),
    }
  })
}

function safeParse(v: string | null): unknown {
  if (!v) return []
  try {
    return JSON.parse(v)
  } catch {
    return []
  }
}

export async function createUser(input: {
  name: string
  username: string
  password: string
  permissions: Permission[]
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()

  const name = input.name.trim()
  const uname = input.username.trim().toLowerCase()
  const password = input.password
  const perms = sanitizePerms(input.permissions)

  if (!name || !uname || !password) {
    return { ok: false, error: "Todos los campos son obligatorios." }
  }
  if (password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." }
  }
  if (!/^[a-z0-9_.-]+$/.test(uname)) {
    return { ok: false, error: "El usuario solo puede tener letras, números, puntos, guiones y guion bajo." }
  }

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.username, uname)).limit(1)
  if (existing.length > 0) {
    return { ok: false, error: "Ese nombre de usuario ya existe." }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: `${uname}@camvexrd.com`,
        password,
        name,
        username: uname,
      },
    })
    await db
      .update(user)
      .set({ role: "editor", permissions: JSON.stringify(perms), recoveryPassword: encryptSecret(password) })
      .where(eq(user.username, uname))

    await logActivity(me, "created", "Usuarios", `Creó al usuario “${name}” (@${uname})`)
    revalidatePath("/admin/dashboard")
    return { ok: true }
  } catch (err) {
    console.log("[v0] createUser error:", err instanceof Error ? err.message : err)
    return { ok: false, error: "No se pudo crear el usuario." }
  }
}

export async function setUserPassword(input: {
  userId: string
  password: string
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()

  const password = input.password
  if (!password || password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." }
  }

  const target = await db.select({ id: user.id, name: user.name, username: user.username }).from(user).where(eq(user.id, input.userId)).limit(1)
  if (target.length === 0) return { ok: false, error: "Usuario no encontrado." }

  try {
    await auth.api.setUserPassword({
      body: { userId: input.userId, newPassword: password },
      headers: await headers(),
    })
    await db.update(user).set({ recoveryPassword: encryptSecret(password) }).where(eq(user.id, input.userId))
    await logActivity(me, "updated", "Usuarios", `Restableció la contraseña de “${target[0].name}” (@${target[0].username})`)
    revalidatePath("/admin/dashboard")
    return { ok: true }
  } catch (err) {
    console.log("[v0] setUserPassword error:", err instanceof Error ? err.message : err)
    return { ok: false, error: "No se pudo actualizar la contraseña." }
  }
}

/**
 * Self-service password change for the currently logged-in panel user (admin or
 * editor). Verifies the current password through Better Auth, sets the new one,
 * and captures an encrypted recoverable copy so the owner can still reveal it.
 */
export async function changeMyPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdminUser()

  const current = input.currentPassword || ""
  const next = input.newPassword || ""
  if (next.length < 8) {
    return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." }
  }

  try {
    await auth.api.changePassword({
      body: { currentPassword: current, newPassword: next, revokeOtherSessions: false },
      headers: await headers(),
    })
  } catch (err) {
    console.log("[v0] changeMyPassword error:", err instanceof Error ? err.message : err)
    return { ok: false, error: "La contraseña actual no es correcta." }
  }

  await db.update(user).set({ recoveryPassword: encryptSecret(next) }).where(eq(user.id, me.id))
  await logActivity(me, "updated", "Usuarios", `Cambió su propia contraseña`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function updateUserPermissions(input: {
  userId: string
  permissions: Permission[]
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const perms = sanitizePerms(input.permissions)

  const target = await db.select({ role: user.role, name: user.name, username: user.username }).from(user).where(eq(user.id, input.userId)).limit(1)
  if (target.length === 0) return { ok: false, error: "Usuario no encontrado." }
  if (target[0].role === "admin") return { ok: false, error: "No se pueden modificar los permisos del administrador." }

  await db.update(user).set({ permissions: JSON.stringify(perms) }).where(eq(user.id, input.userId))
  await logActivity(
    me,
    "updated",
    "Usuarios",
    `Cambió los permisos de “${target[0].name}” a: ${perms.length ? perms.join(", ") : "ninguno"}`,
  )
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

/**
 * Sets which features are VISIBLE to an editor even when the matching permission
 * is not granted. A visible-but-not-granted feature shows a "función no
 * habilitada por el administrador" notice instead of the working panel.
 */
export async function updateUserVisibleFeatures(input: {
  userId: string
  visibleFeatures: Permission[]
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const visible = sanitizePerms(input.visibleFeatures)

  const target = await db.select({ role: user.role, name: user.name }).from(user).where(eq(user.id, input.userId)).limit(1)
  if (target.length === 0) return { ok: false, error: "Usuario no encontrado." }
  if (target[0].role === "admin") return { ok: false, error: "El administrador ya ve todas las funciones." }

  await db.update(user).set({ visibleFeatures: JSON.stringify(visible) }).where(eq(user.id, input.userId))
  await logActivity(
    me,
    "updated",
    "Usuarios",
    `Cambió las funciones visibles de “${target[0].name}” a: ${visible.length ? visible.join(", ") : "ninguna"}`,
  )
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

/**
 * Toggles "maintenance mode" for a single editor. When enabled, that user is
 * locked out of the admin panel and shown a maintenance notice on their next
 * navigation/login. Admins cannot be put into maintenance.
 */
export async function setUserMaintenance(input: {
  userId: string
  maintenance: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireFullAdmin()
  if (input.userId === admin.id) {
    return { ok: false, error: "No puedes ponerte en mantenimiento a ti mismo." }
  }

  const target = await db.select({ role: user.role, name: user.name, username: user.username }).from(user).where(eq(user.id, input.userId)).limit(1)
  if (target.length === 0) return { ok: false, error: "Usuario no encontrado." }
  if (target[0].role === "admin") {
    return { ok: false, error: "No se puede poner en mantenimiento a un administrador." }
  }

  await db.update(user).set({ maintenance: input.maintenance }).where(eq(user.id, input.userId))
  await logActivity(
    admin,
    "updated",
    "Usuarios",
    `${input.maintenance ? "Bloqueó" : "Restauró"} el acceso de “${target[0].name}” (@${target[0].username})`,
  )
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function deleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireFullAdmin()
  if (userId === admin.id) return { ok: false, error: "No puedes eliminar tu propia cuenta." }

  const target = await db.select({ role: user.role, name: user.name, username: user.username }).from(user).where(eq(user.id, userId)).limit(1)
  if (target.length === 0) return { ok: false, error: "Usuario no encontrado." }
  if (target[0].role === "admin") return { ok: false, error: "No se puede eliminar la cuenta de administrador." }

  await db.delete(user).where(and(eq(user.id, userId), ne(user.role, "admin")))
  await logActivity(admin, "deleted", "Usuarios", `Eliminó al usuario “${target[0].name}” (@${target[0].username})`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}
