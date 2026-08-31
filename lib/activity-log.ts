import "server-only"
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
