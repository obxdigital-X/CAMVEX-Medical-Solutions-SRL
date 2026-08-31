import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

export type Permission = "catalog" | "messages" | "sheets" | "quotes"

/** Every permission an editor can be granted. Admins implicitly have all of them. */
export const ALL_PERMISSIONS: Permission[] = ["catalog", "messages", "sheets", "quotes"]

export type AdminUser = {
  id: string
  name: string
  username: string | null
  role: string | null
  isAdmin: boolean
  permissions: Permission[]
  maintenance: boolean
}

/**
 * Reads the current session and loads the acting user's role + permissions.
 * Returns null if there is no valid session. Admins implicitly have every
 * permission. This runs on the server for every protected action/page.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      maintenance: user.maintenance,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  const u = rows[0]
  if (!u) return null

  const isAdmin = u.role === "admin"
  let permissions: Permission[] = []
  if (isAdmin) {
    permissions = [...ALL_PERMISSIONS]
  } else if (u.permissions) {
    try {
      const parsed = JSON.parse(u.permissions)
      if (Array.isArray(parsed))
        permissions = parsed.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p))
    } catch {
      permissions = []
    }
  }

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    isAdmin,
    permissions,
    // Admins can never be locked out of their own control panel.
    maintenance: isAdmin ? false : Boolean(u.maintenance),
  }
}

/** Throws if there is no session at all, or if the user is in maintenance mode. */
export async function requireAdminUser(): Promise<AdminUser> {
  const u = await getAdminUser()
  if (!u) throw new Error("No autorizado")
  if (u.maintenance) throw new Error("Cuenta en mantenimiento")
  return u
}

/** Throws unless the user is a full admin. */
export async function requireFullAdmin(): Promise<AdminUser> {
  const u = await requireAdminUser()
  if (!u.isAdmin) throw new Error("Requiere permisos de administrador")
  return u
}

/** Throws unless the user is admin or has the given permission. */
export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const u = await requireAdminUser()
  if (!u.isAdmin && !u.permissions.includes(permission)) {
    throw new Error("No tienes permiso para esta acción")
  }
  return u
}
