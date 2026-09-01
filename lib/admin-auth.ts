import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

export type Permission = "catalog" | "messages" | "sheets" | "quotes" | "stats"

/** Every permission an editor can be granted. Admins implicitly have all of them. */
export const ALL_PERMISSIONS: Permission[] = ["catalog", "messages", "sheets", "quotes", "stats"]

export type AdminUser = {
  id: string
  name: string
  username: string | null
  role: string | null
  isAdmin: boolean
  permissions: Permission[]
  // Features shown to this user even without the matching permission. Always
  // includes everything in `permissions` (a granted feature is always visible).
  visibleFeatures: Permission[]
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
      visibleFeatures: user.visibleFeatures,
      maintenance: user.maintenance,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  const u = rows[0]
  if (!u) return null

  const parsePerms = (raw: string | null): Permission[] => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed))
        return parsed.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p))
    } catch {}
    return []
  }

  const isAdmin = u.role === "admin"
  const permissions: Permission[] = isAdmin ? [...ALL_PERMISSIONS] : parsePerms(u.permissions)

  // Visible = explicitly shown features UNION granted permissions (a granted
  // feature is always visible). Admins see everything.
  const visibleFeatures: Permission[] = isAdmin
    ? [...ALL_PERMISSIONS]
    : Array.from(new Set<Permission>([...permissions, ...parsePerms(u.visibleFeatures)]))

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    isAdmin,
    permissions,
    visibleFeatures,
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
