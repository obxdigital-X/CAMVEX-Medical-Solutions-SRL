import type { Quotation, QuoteItem } from "@/app/admin/actions/quotations"

// Shared contact block + money helpers used by every quotation renderer
// (panel, HTML preview, PDF, Word) so the numbers and formatting never drift.

export const CONTACT = {
  web: "www.camvexmedicalsolutions.com",
  phone: "829-862-2291",
  email: "Ventas@camvexrd.com",
}

export function currencySymbol(currency: string): string {
  return currency === "USD" ? "US$" : "RD$"
}

/** Formats an amount like "RD$ 12,500.00". */
export function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0
  const formatted = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currencySymbol(currency)} ${formatted}`
}

export function lineTotal(item: QuoteItem): number {
  return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
}

export type QuoteTotals = { subtotal: number; tax: number; total: number }

export function computeTotals(quote: Pick<Quotation, "items" | "taxEnabled" | "taxRate">): QuoteTotals {
  const subtotal = quote.items.reduce((sum, it) => sum + lineTotal(it), 0)
  const tax = quote.taxEnabled ? subtotal * ((Number(quote.taxRate) || 0) / 100) : 0
  return { subtotal, tax, total: subtotal + tax }
}

/** Formats an ISO date (or now) as a Spanish long date, e.g. "28 de agosto de 2026". */
export function formatLongDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" })
}
