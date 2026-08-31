"use server"

import { db } from "@/lib/db"
import { quotation } from "@/lib/db/schema"
import { requirePermission } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { desc, eq, like } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type QuoteItem = {
  description: string
  image: string
  quantity: number
  unitPrice: number
}

export type Quotation = {
  id: number
  number: string
  clientName: string
  clientContact: string
  clientEmail: string
  clientPhone: string
  title: string
  preparedBy: string
  preparedByContact: string
  currency: "DOP" | "USD"
  taxEnabled: boolean
  taxRate: number
  validityDays: number
  notes: string
  items: QuoteItem[]
  createdAt: string
  updatedAt: string
}

// Payload for create/update (no id/number/timestamps — the number is assigned
// automatically on create and preserved on update).
export type QuotationInput = Omit<Quotation, "id" | "number" | "createdAt" | "updatedAt">

function parseItems(raw: string): QuoteItem[] {
  try {
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        description: String(r.description ?? ""),
        image: String(r.image ?? ""),
        quantity: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
        unitPrice: Number.isFinite(Number(r.unitPrice)) ? Number(r.unitPrice) : 0,
      }))
  } catch {
    return []
  }
}

function mapRow(r: typeof quotation.$inferSelect): Quotation {
  const rate = Number.parseFloat(r.taxRate)
  return {
    id: r.id,
    number: r.number,
    clientName: r.clientName,
    clientContact: r.clientContact,
    clientEmail: r.clientEmail,
    clientPhone: r.clientPhone,
    title: r.title,
    preparedBy: r.preparedBy,
    preparedByContact: r.preparedByContact,
    currency: r.currency === "USD" ? "USD" : "DOP",
    taxEnabled: r.taxEnabled,
    taxRate: Number.isFinite(rate) ? rate : 18,
    validityDays: r.validityDays,
    notes: r.notes,
    items: parseItems(r.items),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// Normalizes and JSON-encodes the item list + scalar fields for storage.
function encode(input: QuotationInput) {
  const items = input.items
    .map((r) => ({
      description: r.description.trim().slice(0, 600),
      image: r.image.trim().slice(0, 2000),
      quantity: Math.max(0, Math.round(Number(r.quantity) || 0)),
      unitPrice: Math.max(0, Number(r.unitPrice) || 0),
    }))
    .filter((r) => r.description || r.image || r.quantity || r.unitPrice)
  const rate = Math.max(0, Math.min(100, Number(input.taxRate) || 0))
  return {
    clientName: input.clientName.trim().slice(0, 300),
    clientContact: input.clientContact.trim().slice(0, 300),
    clientEmail: input.clientEmail.trim().slice(0, 300),
    clientPhone: input.clientPhone.trim().slice(0, 100),
    title: input.title.trim().slice(0, 300),
    preparedBy: input.preparedBy.trim().slice(0, 300),
    preparedByContact: input.preparedByContact.trim().slice(0, 300),
    currency: input.currency === "USD" ? "USD" : "DOP",
    taxEnabled: Boolean(input.taxEnabled),
    taxRate: String(rate),
    validityDays: Math.max(0, Math.round(Number(input.validityDays) || 0)),
    notes: input.notes.trim().slice(0, 3000),
    items: JSON.stringify(items),
  }
}

// Builds the next correlative number for the current year, e.g. COT-2026-001.
async function nextQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `COT-${year}-`
  const rows = await db
    .select({ number: quotation.number })
    .from(quotation)
    .where(like(quotation.number, `${prefix}%`))
  let max = 0
  for (const r of rows) {
    const n = Number.parseInt(r.number.slice(prefix.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`
}

export async function listQuotations(): Promise<Quotation[]> {
  await requirePermission("quotes")
  const rows = await db.select().from(quotation).orderBy(desc(quotation.updatedAt))
  return rows.map(mapRow)
}

export async function createQuotation(
  input: QuotationInput,
): Promise<{ ok: boolean; error?: string; id?: number; number?: string }> {
  const me = await requirePermission("quotes")
  if (!input.clientName.trim()) return { ok: false, error: "El nombre del cliente/empresa es obligatorio." }
  const number = await nextQuotationNumber()
  const values = { ...encode(input), number, updatedAt: new Date() }
  const [row] = await db.insert(quotation).values(values).returning({ id: quotation.id })
  await logActivity(me, "created", "Cotizaciones", `Creó ${number} para “${input.clientName.trim()}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true, id: row?.id, number }
}

export async function updateQuotation(
  input: QuotationInput & { id: number },
): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("quotes")
  if (!input.clientName.trim()) return { ok: false, error: "El nombre del cliente/empresa es obligatorio." }
  const [existing] = await db.select({ number: quotation.number }).from(quotation).where(eq(quotation.id, input.id)).limit(1)
  await db
    .update(quotation)
    .set({ ...encode(input), updatedAt: new Date() })
    .where(eq(quotation.id, input.id))
  await logActivity(me, "updated", "Cotizaciones", `Editó ${existing?.number ?? `#${input.id}`} para “${input.clientName.trim()}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function deleteQuotation(id: number): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("quotes")
  const [existing] = await db
    .select({ number: quotation.number, clientName: quotation.clientName })
    .from(quotation)
    .where(eq(quotation.id, id))
    .limit(1)
  await db.delete(quotation).where(eq(quotation.id, id))
  await logActivity(
    me,
    "deleted",
    "Cotizaciones",
    `Eliminó ${existing?.number ?? `#${id}`}${existing?.clientName ? ` de “${existing.clientName}”` : ""}`,
  )
  revalidatePath("/admin/dashboard")
  return { ok: true }
}
