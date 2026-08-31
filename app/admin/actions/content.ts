"use server"

import { db } from "@/lib/db"
import { siteContent } from "@/lib/db/schema"
import { requireFullAdmin } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { withDefaults, type ContentMap } from "@/lib/site-content"
import { LANGS, DEFAULT_LANG, type Lang, isLang } from "@/lib/i18n"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type { ContentMap }
export type ContentByLang = Partial<Record<Lang, ContentMap>>

// Public reader — used by the marketing site. Returns stored values grouped by
// language. Spanish is merged with defaults so the site always has a full set;
// other languages return only what has been translated (the site falls back to
// Spanish, then to the built-in default, at render time).
export async function getPublicContent(): Promise<ContentByLang> {
  const rows = await db.select().from(siteContent)
  const byLang: Record<string, ContentMap> = {}
  for (const r of rows) {
    if (!byLang[r.lang]) byLang[r.lang] = {}
    byLang[r.lang][r.key] = r.value
  }
  const result: ContentByLang = {}
  for (const l of LANGS) {
    result[l] = l === DEFAULT_LANG ? withDefaults(byLang[l] ?? {}) : (byLang[l] ?? {})
  }
  return result
}

// Admin reader for a single language. Merges defaults for Spanish; for other
// languages returns the stored value or falls back to the Spanish default so
// the editor always shows a starting point.
export async function getContentForLang(lang: string): Promise<ContentMap> {
  await requireFullAdmin()
  const l: Lang = isLang(lang) ? lang : DEFAULT_LANG
  const rows = await db.select().from(siteContent).where(eq(siteContent.lang, l))
  const map: ContentMap = {}
  for (const r of rows) map[r.key] = r.value
  return map
}

export async function updateContent(
  lang: string,
  entries: ContentMap,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireFullAdmin()
  const l: Lang = isLang(lang) ? lang : DEFAULT_LANG
  const keys = Object.keys(entries)
  if (keys.length === 0) return { ok: true }

  for (const key of keys) {
    const value = entries[key] ?? ""
    await db
      .insert(siteContent)
      .values({ lang: l, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [siteContent.lang, siteContent.key],
        set: { value, updatedAt: new Date() },
      })
  }
  await logActivity(
    me,
    "updated",
    "Textos del sitio",
    `Actualizó ${keys.length} texto${keys.length === 1 ? "" : "s"} (${l.toUpperCase()})`,
  )
  revalidatePath("/admin/dashboard")
  revalidatePath("/")
  return { ok: true }
}
