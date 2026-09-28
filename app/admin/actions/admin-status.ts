"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { adminStatus } from "@/lib/db/schema"
import { requireFullAdmin } from "@/lib/admin-auth"

const STATUS_ID = 1

export async function getAdminOutageStatus(): Promise<boolean> {
  const row = await db
    .select({ outage: adminStatus.outage })
    .from(adminStatus)
    .where(eq(adminStatus.id, STATUS_ID))
    .limit(1)
  return Boolean(row[0]?.outage)
}

export async function setAdminOutage(outage: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireFullAdmin()
    await db
      .insert(adminStatus)
      .values({ id: STATUS_ID, outage })
      .onConflictDoUpdate({ target: adminStatus.id, set: { outage } })
    revalidatePath("/admin")
    revalidatePath("/admin/dashboard")
    return { ok: true }
  } catch (error) {
    console.error("[v0] setAdminOutage error:", error)
    return { ok: false, error: "No se pudo actualizar el estado del panel." }
  }
}
