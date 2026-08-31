"use server"

import { db } from "@/lib/db"
import { equipment, equipmentTranslation } from "@/lib/db/schema"
import { requirePermission } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { isLang, DEFAULT_LANG, LANGS, type Lang } from "@/lib/i18n"
import { translateCatalogItems } from "@/lib/translate-catalog"
import { asc, eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type EquipmentItem = {
  id: number
  name: string
  category: string
  description: string
  image: string
  tag: string
  specs: string[]
  sortOrder: number
  active: boolean
}

export type EquipmentTranslationFields = {
  name: string
  category: string
  description: string
  specs: string[]
}

function parseSpecs(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string")
    return []
  } catch {
    // Fallback: comma-separated
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

function mapRow(r: typeof equipment.$inferSelect): EquipmentItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    image: r.image,
    tag: r.tag,
    specs: parseSpecs(r.specs),
    sortOrder: r.sortOrder,
    active: r.active,
  }
}

// Public read for the marketing site — only active items, no auth required.
// When a non-Spanish language is requested, non-empty translated fields
// override the base (Spanish) row; anything missing falls back to the base.
export async function getPublicEquipment(lang?: string): Promise<EquipmentItem[]> {
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.active, true))
    .orderBy(asc(equipment.sortOrder), asc(equipment.id))
  const base = rows.map(mapRow)

  const l: Lang = isLang(lang) ? lang : DEFAULT_LANG
  if (l === DEFAULT_LANG) return base

  const translations = await db
    .select()
    .from(equipmentTranslation)
    .where(eq(equipmentTranslation.lang, l))
  const byId = new Map(translations.map((t) => [t.equipmentId, t]))

  return base.map((item) => {
    const tr = byId.get(item.id)
    if (!tr) return item
    const translatedSpecs = parseSpecs(tr.specs)
    return {
      ...item,
      name: tr.name || item.name,
      category: tr.category || item.category,
      description: tr.description || item.description,
      specs: translatedSpecs.length ? translatedSpecs : item.specs,
    }
  })
}

// Public read for the marketing site across every language in one round-trip.
// Returns a map keyed by language so the client can switch instantly. Each
// language's list applies its translations over the base (Spanish) row, with
// per-field fallback to the base value when a translation is missing.
export async function getPublicEquipmentByLang(): Promise<Partial<Record<Lang, EquipmentItem[]>>> {
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.active, true))
    .orderBy(asc(equipment.sortOrder), asc(equipment.id))
  const base = rows.map(mapRow)

  const allTranslations = await db.select().from(equipmentTranslation)
  // lang -> (equipmentId -> translation row)
  const byLang = new Map<string, Map<number, (typeof allTranslations)[number]>>()
  for (const tr of allTranslations) {
    if (!byLang.has(tr.lang)) byLang.set(tr.lang, new Map())
    byLang.get(tr.lang)!.set(tr.equipmentId, tr)
  }

  // Auto-translate (and cache) any active item that has no translation yet for a
  // non-Spanish language. Each language is handled in parallel; failures fall
  // back to the base Spanish text so the page never breaks.
  const targetLangs = LANGS.filter((l) => l !== DEFAULT_LANG)
  await Promise.all(
    targetLangs.map(async (l) => {
      const map = byLang.get(l) ?? new Map()
      const missing = base.filter((item) => !map.has(item.id))
      if (missing.length === 0) return

      const translated = await translateCatalogItems(
        missing.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          description: m.description,
          specs: m.specs,
        })),
        l,
      )
      if (translated.length === 0) return

      for (const tr of translated) {
        const values = {
          equipmentId: tr.id,
          lang: l,
          name: tr.name,
          category: tr.category,
          description: tr.description,
          specs: JSON.stringify(tr.specs),
          auto: true,
          updatedAt: new Date(),
        }
        // Cache for future loads. Never overwrite an existing (manual) row.
        await db.insert(equipmentTranslation).values(values).onConflictDoNothing({
          target: [equipmentTranslation.equipmentId, equipmentTranslation.lang],
        })
        map.set(tr.id, values as unknown as (typeof allTranslations)[number])
      }
      byLang.set(l, map)
    }),
  )

  const result: Partial<Record<Lang, EquipmentItem[]>> = {}
  for (const l of LANGS) {
    if (l === DEFAULT_LANG) {
      result[l] = base
      continue
    }
    const map = byLang.get(l)
    result[l] = base.map((item) => {
      const tr = map?.get(item.id)
      if (!tr) return item
      const translatedSpecs = parseSpecs(tr.specs)
      return {
        ...item,
        name: tr.name || item.name,
        category: tr.category || item.category,
        description: tr.description || item.description,
        specs: translatedSpecs.length ? translatedSpecs : item.specs,
      }
    })
  }
  return result
}

export async function listEquipment(): Promise<EquipmentItem[]> {
  await requirePermission("catalog")
  const rows = await db.select().from(equipment).orderBy(asc(equipment.sortOrder), asc(equipment.id))
  return rows.map(mapRow)
}

export async function createEquipment(input: {
  name: string
  category: string
  description: string
  image: string
  tag: string
  specs: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("catalog")
  const name = input.name.trim()
  if (!name) return { ok: false, error: "El nombre es obligatorio." }

  const rows = await db.select({ s: equipment.sortOrder }).from(equipment)
  const nextOrder = rows.length ? Math.max(...rows.map((m) => m.s)) + 10 : 10

  await db.insert(equipment).values({
    name,
    category: input.category.trim(),
    description: input.description.trim(),
    image: input.image.trim(),
    tag: input.tag.trim(),
    specs: JSON.stringify(input.specs.map((s) => s.trim()).filter(Boolean)),
    sortOrder: nextOrder,
  })
  await logActivity(me, "created", "Catálogo", `Agregó el equipo “${name}”`)
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

export async function updateEquipment(input: {
  id: number
  name: string
  category: string
  description: string
  image: string
  tag: string
  specs: string[]
  active: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("catalog")
  const name = input.name.trim()
  if (!name) return { ok: false, error: "El nombre es obligatorio." }

  await db
    .update(equipment)
    .set({
      name,
      category: input.category.trim(),
      description: input.description.trim(),
      image: input.image.trim(),
      tag: input.tag.trim(),
      specs: JSON.stringify(input.specs.map((s) => s.trim()).filter(Boolean)),
      active: input.active,
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, input.id))
  await logActivity(me, "updated", "Catálogo", `Editó el equipo “${name}”${input.active ? "" : " (oculto)"}`)
  // The Spanish source changed, so drop AI-generated translations for this item;
  // they'll be regenerated on the next public load. Manual (auto=false) rows stay.
  await db
    .delete(equipmentTranslation)
    .where(and(eq(equipmentTranslation.equipmentId, input.id), eq(equipmentTranslation.auto, true)))
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

export async function deleteEquipment(id: number): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("catalog")
  const [existing] = await db.select({ name: equipment.name }).from(equipment).where(eq(equipment.id, id)).limit(1)
  await db.delete(equipment).where(eq(equipment.id, id))
  await logActivity(me, "deleted", "Catálogo", `Eliminó el equipo “${existing?.name ?? `#${id}`}”`)
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}

// Read a single language's translation for one equipment item (admin only).
export async function getEquipmentTranslation(
  equipmentId: number,
  lang: string,
): Promise<EquipmentTranslationFields> {
  await requirePermission("catalog")
  const empty: EquipmentTranslationFields = { name: "", category: "", description: "", specs: [] }
  if (!isLang(lang) || lang === DEFAULT_LANG) return empty
  const [row] = await db
    .select()
    .from(equipmentTranslation)
    .where(and(eq(equipmentTranslation.equipmentId, equipmentId), eq(equipmentTranslation.lang, lang)))
    .limit(1)
  if (!row) return empty
  return {
    name: row.name,
    category: row.category,
    description: row.description,
    specs: parseSpecs(row.specs),
  }
}

// Save (upsert) a translation for one equipment item (admin only).
// Spanish is stored on the base row, so it is rejected here.
export async function saveEquipmentTranslation(input: {
  equipmentId: number
  lang: string
  name: string
  category: string
  description: string
  specs: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("catalog")
  if (!isLang(input.lang) || input.lang === DEFAULT_LANG) {
    return { ok: false, error: "Idioma inválido." }
  }
  const values = {
    equipmentId: input.equipmentId,
    lang: input.lang,
    name: input.name.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    specs: JSON.stringify(input.specs.map((s) => s.trim()).filter(Boolean)),
    auto: false,
    updatedAt: new Date(),
  }
  await db
    .insert(equipmentTranslation)
    .values(values)
    .onConflictDoUpdate({
      target: [equipmentTranslation.equipmentId, equipmentTranslation.lang],
      set: {
        name: values.name,
        category: values.category,
        description: values.description,
        specs: values.specs,
        auto: false,
        updatedAt: values.updatedAt,
      },
    })
  await logActivity(
    me,
    "updated",
    "Catálogo",
    `Guardó la traducción (${input.lang.toUpperCase()}) de “${values.name || `equipo #${input.equipmentId}`}”`,
  )
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}
