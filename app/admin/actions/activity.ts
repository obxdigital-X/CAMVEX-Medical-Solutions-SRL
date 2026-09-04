"use server"

import { db } from "@/lib/db"
import { activityLog } from "@/lib/db/schema"
import { getAdminUser, requireFullAdmin } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { auth } from "@/lib/auth"
import { desc, lt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

export type ActivityEntry = {
  id: number
  actorName: string
  actorUsername: string
  actorRole: string
  action: string
  entity: string
  summary: string
  createdAt: string
}

/** Full audit trail, newest first. Admin only. Capped to the latest 500 rows. */
export async function listActivity(): Promise<ActivityEntry[]> {
  await requireFullAdmin()
  const rows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(500)
  return rows.map((r) => ({
    id: r.id,
    actorName: r.actorName,
    actorUsername: r.actorUsername,
    actorRole: r.actorRole,
    action: r.action,
    entity: r.entity,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Ends the current admin session from the SERVER: records the exit in the Caché
 * (while the session is still valid) and then signs out server-side, which
 * reliably clears the session cookie. Doing this on the server avoids the v0
 * preview iframe edge case where the client-side signOut fetch fails to delete
 * the cross-site (`sameSite:none`) cookie, leaving the user "still logged in".
 */
export async function endAdminSession(): Promise<void> {
  const reqHeaders = await headers()
  const me = await getAdminUser()
  if (me) {
    await logActivity(me, "logout", "Accesos", "Salió del panel de administración")
  }
  try {
    await auth.api.signOut({ headers: reqHeaders })
  } catch (err) {
    console.log("[v0] endAdminSession signOut error:", err instanceof Error ? err.message : err)
  }
}

/**
 * Trims the audit trail. With no argument it clears everything; with a number
 * of days it removes entries older than that. Admin only.
 */
export async function clearActivity(olderThanDays?: number): Promise<{ ok: boolean }> {
  await requireFullAdmin()
  if (olderThanDays && olderThanDays > 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    await db.delete(activityLog).where(lt(activityLog.createdAt, cutoff))
  } else {
    await db.delete(activityLog)
  }
  revalidatePath("/admin/dashboard")
  return { ok: true }
}
