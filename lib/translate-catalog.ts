import { generateText, Output } from "ai"
import { z } from "zod"
import type { Lang } from "@/lib/i18n"

// Human-readable language names for the translation prompt.
const LANG_NAMES: Record<Lang, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  pt: "Portuguese",
  zh: "Simplified Chinese",
}

export type TranslatableItem = {
  id: number
  name: string
  category: string
  description: string
  specs: string[]
}

export type TranslatedItem = {
  id: number
  name: string
  category: string
  description: string
  specs: string[]
}

const itemSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  specs: z.array(z.string()),
})

const resultSchema = z.object({
  items: z.array(itemSchema),
})

// Translates a batch of catalog items into `target` using the AI Gateway.
// Returns an empty array on any failure so callers can fall back to base text.
export async function translateCatalogItems(
  items: TranslatableItem[],
  target: Lang,
): Promise<TranslatedItem[]> {
  if (items.length === 0) return []
  const targetName = LANG_NAMES[target]

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: resultSchema }),
      prompt:
        `You are a professional medical-industry translator. Translate the following ` +
        `product catalog items from Spanish into ${targetName}. ` +
        `Translate the "name", "category", "description" and every entry in "specs". ` +
        `Keep the exact same "id" for each item. Preserve numbers, units, model codes, ` +
        `and brand names unchanged. Keep the tone professional and concise. ` +
        `Return the same number of items in the same order.\n\n` +
        `Items (JSON):\n${JSON.stringify(items)}`,
    })

    const byId = new Map(output.items.map((it) => [it.id, it]))
    // Preserve input order and guarantee one output per input.
    return items.map((src) => {
      const tr = byId.get(src.id)
      return {
        id: src.id,
        name: tr?.name?.trim() || src.name,
        category: tr?.category?.trim() || src.category,
        description: tr?.description?.trim() || src.description,
        specs: tr?.specs?.length ? tr.specs : src.specs,
      }
    })
  } catch (err) {
    console.log("[v0] catalog translation failed:", (err as Error)?.message)
    return []
  }
}
