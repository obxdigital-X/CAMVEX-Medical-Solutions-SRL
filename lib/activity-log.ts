import "server-only"
import { and, eq, gte } from "drizzle-orm"
import { db } from "@/lib/db"
import { activityLog } from "@/lib/db/schema"
import type { AdminUser } from "@/lib/admin-auth"

export type ActivityAction = "created" | "updated" | "deleted" | "login" | "logout"

/**
 * Records a single audit-trail entry ("Caché"). Called from server actions
 * right after a successful mutation. It is intentionally best-effort: any
 * failure here is swallowed so it can never break the underlying action.
 */
export async function logActivity(
  actor: Pick<AdminUser, "id" | "name" | "username" | "isAdmin">,
  action: ActivityAction,
  entity: string,
  summary: string,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      actorId: actor.id,
      actorName: actor.name ?? "",
      actorUsername: actor.username ?? "",
      actorRole: actor.isAdmin ? "admin" : "editor",
      action,
      entity,
      summary: summary.slice(0, 500),
    })
  } catch (err) {
    console.log("[v0] logActivity error:", err instanceof Error ? err.message : err)
  }
}

// Minimum gap between two access entries for the same user. Loading the
// dashboard many times (navigation, refresh) within this window logs only one
// "Entró al panel" entry, so the Caché shows visits without being flooded.
const ACCESS_DEDUP_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Records that a user opened the admin panel. Called on every dashboard load,
 * so it captures returning users whose session cookie is still valid (they
 * never trigger a fresh login) — the case the session-create hook missed.
 * Deduplicated per user over ACCESS_DEDUP_MS. Best-effort: never throws.
 */
export async function recordAccess(
  actor: Pick<AdminUser, "id" | "name" | "username" | "isAdmin">,
): Promise<void> {
  try {
    const since = new Date(Date.now() - ACCESS_DEDUP_MS)
    const recent = await db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(and(eq(activityLog.actorId, actor.id), eq(activityLog.action, "login"), gte(activityLog.createdAt, since)))
      .limit(1)
    if (recent.length > 0) return // already logged an access in this window
    await logActivity(actor, "login", "Accesos", "Entró al panel de administración")
  } catch (err) {
    console.log("[v0] recordAccess error:", err instanceof Error ? err.message : err)
  }
}
