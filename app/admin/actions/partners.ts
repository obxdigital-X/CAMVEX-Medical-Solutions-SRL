"use server"

import { db } from "@/lib/db"
import { partner } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireFullAdmin } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"

export type Partner = {
  id: number
  name: string
  image: string
  active: boolean
  sortOrder: number
}

function mapRow(r: typeof partner.$inferSelect): Partner {
  return {
    id: r.id,
    name: r.name,
    image: r.image,
    active: r.active,
    sortOrder: r.sortOrder,
  }
}

/** All partners for the admin panel, ordered by position. */
export async function listPartners(): Promise<Partner[]> {
  const rows = await db.select().from(partner).orderBy(asc(partner.sortOrder), asc(partner.id))
  return rows.map(mapRow)
}

/** Active partners for the public home-page ticker, ordered by position. */
export async function getPublicPartners(): Promise<{ name: string; src: string }[]> {
  const rows = await db
    .select()
    .from(partner)
    .where(eq(partner.active, true))
    .orderBy(asc(partner.sortOrder), asc(partner.id))
  return rows.filter((r) => r.image.trim()).map((r) => ({ name: r.name, src: r.image }))
}

export async function createPartner(input: {
  name: string
  image: string
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const name = input.name.trim()
  const image = input.image.trim()
  if (!image) return { ok: false, error: "Debes subir o indicar un logo." }

  const rows = await db.select({ s: partner.sortOrder }).from(partner)
  const nextOrder = rows.length ? Math.max(...rows.map((m) => m.s)) + 10 : 10

  await db.insert(partner).values({ name, image, sortOrder: nextOrder })
  await logActivity(me, "created", "Aliados", `Agregó el logo “${name || image}”`)
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

export async function updatePartner(input: {
  id: number
  name: string
  image: string
  active: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const name = input.name.trim()
  const image = input.image.trim()
  if (!image) return { ok: false, error: "Debes subir o indicar un logo." }

  await db
    .update(partner)
    .set({ name, image, active: input.active, updatedAt: new Date() })
    .where(eq(partner.id, input.id))
  await logActivity(me, "updated", "Aliados", `Editó el logo “${name || image}”${input.active ? "" : " (oculto)"}`)
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

export async function deletePartner(id: number): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const [existing] = await db.select({ name: partner.name }).from(partner).where(eq(partner.id, id)).limit(1)
  await db.delete(partner).where(eq(partner.id, id))
  await logActivity(me, "deleted", "Aliados", `Eliminó el logo “${existing?.name ?? `#${id}`}”`)
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

/**
 * Persists a new order. Receives the full list of partner ids in the desired
 * visual order and rewrites sortOrder in steps of 10.
 */
export async function reorderPartners(orderedIds: number[]): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(partner)
        .set({ sortOrder: (index + 1) * 10, updatedAt: new Date() })
        .where(eq(partner.id, id)),
    ),
  )
  await logActivity(me, "updated", "Aliados", "Reordenó los logos del slider")
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}
