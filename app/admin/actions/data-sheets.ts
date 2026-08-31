"use server"

import { db } from "@/lib/db"
import { dataSheet } from "@/lib/db/schema"
import { requirePermission } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type SpecRow = { param: string; value: string }

export type DataSheet = {
  id: number
  title: string
  subtitle: string
  intro: string
  image: string
  formula: string
  manufacturer: string
  presentation: string
  characteristics: string[]
  specs: SpecRow[]
  applications: string[]
  createdAt: string
  updatedAt: string
}

// Payload for create/update (no id/timestamps).
export type DataSheetInput = Omit<DataSheet, "id" | "createdAt" | "updatedAt">

function parseStringArray(raw: string): string[] {
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.filter((s) => typeof s === "string") : []
  } catch {
    return []
  }
}

function parseSpecs(raw: string): SpecRow[] {
  try {
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p
      .filter((r) => r && typeof r === "object")
      .map((r) => ({ param: String(r.param ?? ""), value: String(r.value ?? "") }))
  } catch {
    return []
  }
}

function mapRow(r: typeof dataSheet.$inferSelect): DataSheet {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    intro: r.intro,
    image: r.image,
    formula: r.formula,
    manufacturer: r.manufacturer,
    presentation: r.presentation,
    characteristics: parseStringArray(r.characteristics),
    specs: parseSpecs(r.specs),
    applications: parseStringArray(r.applications),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// Normalizes and JSON-encodes the dynamic list fields for storage.
function encode(input: DataSheetInput) {
  const characteristics = input.characteristics.map((s) => s.trim()).filter(Boolean)
  const applications = input.applications.map((s) => s.trim()).filter(Boolean)
  const specs = input.specs
    .map((r) => ({ param: r.param.trim(), value: r.value.trim() }))
    .filter((r) => r.param || r.value)
  return {
    title: input.title.trim().slice(0, 200),
    subtitle: input.subtitle.trim().slice(0, 200),
    intro: input.intro.trim().slice(0, 2000),
    image: input.image.trim().slice(0, 2000),
    formula: input.formula.trim().slice(0, 200),
    manufacturer: input.manufacturer.trim().slice(0, 300),
    presentation: input.presentation.trim().slice(0, 600),
    characteristics: JSON.stringify(characteristics),
    specs: JSON.stringify(specs),
    applications: JSON.stringify(applications),
  }
}

export async function listDataSheets(): Promise<DataSheet[]> {
  await requirePermission("sheets")
  const rows = await db.select().from(dataSheet).orderBy(desc(dataSheet.updatedAt))
  return rows.map(mapRow)
}

export async function createDataSheet(input: DataSheetInput): Promise<{ ok: boolean; error?: string; id?: number }> {
  const me = await requirePermission("sheets")
  if (!input.title.trim()) return { ok: false, error: "El nombre del producto es obligatorio." }
  const values = { ...encode(input), updatedAt: new Date() }
  const [row] = await db.insert(dataSheet).values(values).returning({ id: dataSheet.id })
  await logActivity(me, "created", "Fichas técnicas", `Creó la ficha “${input.title.trim()}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true, id: row?.id }
}

export async function updateDataSheet(
  input: DataSheetInput & { id: number },
): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("sheets")
  if (!input.title.trim()) return { ok: false, error: "El nombre del producto es obligatorio." }
  await db
    .update(dataSheet)
    .set({ ...encode(input), updatedAt: new Date() })
    .where(eq(dataSheet.id, input.id))
  await logActivity(me, "updated", "Fichas técnicas", `Editó la ficha “${input.title.trim()}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function deleteDataSheet(id: number): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("sheets")
  const [existing] = await db.select({ title: dataSheet.title }).from(dataSheet).where(eq(dataSheet.id, id)).limit(1)
  await db.delete(dataSheet).where(eq(dataSheet.id, id))
  await logActivity(me, "deleted", "Fichas técnicas", `Eliminó la ficha “${existing?.title ?? `#${id}`}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}
