"use client"

import type React from "react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { saveAs } from "file-saver"
import {
  type Quotation,
  type QuotationInput,
  type QuoteItem,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} from "@/app/admin/actions/quotations"
import { ImageUpload } from "./image-upload"
import { computeTotals, formatMoney, formatLongDate, lineTotal } from "./cotizacion/cotizacion-shared"

const CotizacionPreview = dynamic(() => import("./cotizacion/cotizacion-preview"), {
  ssr: false,
  loading: () => <div className="ficha-preview-loading">Cargando vista previa…</div>,
})

type Draft = QuotationInput & { id: number | null; number: string; createdAt: string }

const emptyItem: QuoteItem = { description: "", image: "", quantity: 1, unitPrice: 0 }

const emptyDraft: Draft = {
  id: null,
  number: "",
  createdAt: "",
  clientName: "",
  clientContact: "",
  clientEmail: "",
  clientPhone: "",
  title: "",
  preparedBy: "",
  preparedByContact: "",
  currency: "DOP",
  taxEnabled: true,
  taxRate: 18,
  validityDays: 15,
  notes: "",
  items: [{ ...emptyItem }],
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "cotizacion"
  )
}

// Turns a draft into the shape the PDF/Word/preview templates expect.
function draftToQuote(d: Draft): Quotation {
  return {
    id: d.id ?? 0,
    number: d.number || "COT-000",
    clientName: d.clientName,
    clientContact: d.clientContact,
    clientEmail: d.clientEmail,
    clientPhone: d.clientPhone,
    title: d.title,
    preparedBy: d.preparedBy,
    preparedByContact: d.preparedByContact,
    currency: d.currency,
    taxEnabled: d.taxEnabled,
    taxRate: d.taxRate,
    validityDays: d.validityDays,
    notes: d.notes,
    items: d.items
      .map((r) => ({
        description: r.description.trim(),
        image: r.image.trim(),
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
      }))
      .filter((r) => r.description || r.image || r.quantity || r.unitPrice),
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: "",
  }
}

export function QuotationsPanel({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState<Quotation | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? initialQuotations.filter((it) =>
        [it.number, it.clientName, it.clientContact, it.title, it.preparedBy]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : initialQuotations

  function openCreate() {
    setError(null)
    setDraft({ ...emptyDraft, items: [{ ...emptyItem }] })
  }

  function openEdit(q: Quotation) {
    setError(null)
    setDraft({
      id: q.id,
      number: q.number,
      createdAt: q.createdAt,
      clientName: q.clientName,
      clientContact: q.clientContact,
      clientEmail: q.clientEmail,
      clientPhone: q.clientPhone,
      title: q.title,
      preparedBy: q.preparedBy,
      preparedByContact: q.preparedByContact,
      currency: q.currency,
      taxEnabled: q.taxEnabled,
      taxRate: q.taxRate,
      validityDays: q.validityDays,
      notes: q.notes,
      items: q.items.length ? q.items.map((r) => ({ ...r })) : [{ ...emptyItem }],
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (!draft.clientName.trim()) {
      setError("El nombre del cliente/empresa es obligatorio.")
      return
    }
    setSaving(true)
    setError(null)
    const payload: QuotationInput = {
      clientName: draft.clientName,
      clientContact: draft.clientContact,
      clientEmail: draft.clientEmail,
      clientPhone: draft.clientPhone,
      title: draft.title,
      preparedBy: draft.preparedBy,
      preparedByContact: draft.preparedByContact,
      currency: draft.currency,
      taxEnabled: draft.taxEnabled,
      taxRate: draft.taxRate,
      validityDays: draft.validityDays,
      notes: draft.notes,
      items: draft.items,
    }
    const res =
      draft.id == null ? await createQuotation(payload) : await updateQuotation({ ...payload, id: draft.id })
    setSaving(false)
    if (!res.ok) {
      setError(res.error || "No se pudo guardar la cotización.")
      return
    }
    setNote({
      type: "ok",
      text: draft.id == null ? `Cotización ${"number" in res ? res.number : ""} creada.` : "Cotización actualizada.",
    })
    setDraft(null)
    router.refresh()
  }

  async function remove(q: Quotation) {
    if (!confirm(`¿Eliminar la cotización ${q.number}? Esta acción no se puede deshacer.`)) return
    setBusyId(q.id)
    const res = await deleteQuotation(q.id)
    setBusyId(null)
    if (!res.ok) {
      setNote({ type: "err", text: res.error || "No se pudo eliminar." })
      return
    }
    setNote({ type: "ok", text: "Cotización eliminada." })
    router.refresh()
  }

  async function downloadPdf(quote: Quotation) {
    setExporting(`pdf-${quote.id}`)
    try {
      const [{ pdf }, { CotizacionPdfDocument }, { resolveQuoteImages }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./cotizacion/cotizacion-pdf"),
        import("./cotizacion/cotizacion-assets"),
      ])
      const { logo, images } = await resolveQuoteImages(quote.items)
      const blob = await pdf(<CotizacionPdfDocument quote={quote} logo={logo} images={images} />).toBlob()
      saveAs(blob, `${slugify(quote.number)}-${slugify(quote.clientName)}.pdf`)
    } catch {
      setNote({ type: "err", text: "No se pudo generar el PDF." })
    } finally {
      setExporting(null)
    }
  }

  async function downloadWord(quote: Quotation) {
    setExporting(`word-${quote.id}`)
    try {
      const { buildCotizacionDocx } = await import("./cotizacion/cotizacion-word")
      const blob = await buildCotizacionDocx(quote)
      saveAs(blob, `${slugify(quote.number)}-${slugify(quote.clientName)}.docx`)
    } catch {
      setNote({ type: "err", text: "No se pudo generar el documento de Word." })
    } finally {
      setExporting(null)
    }
  }

  // ----- item helpers (operate on the current draft) -----
  function setItem(i: number, field: keyof QuoteItem, value: string | number) {
    if (!draft) return
    const next = draft.items.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    setDraft({ ...draft, items: next })
  }
  function addItem() {
    if (!draft) return
    setDraft({ ...draft, items: [...draft.items, { ...emptyItem }] })
  }
  function removeItem(i: number) {
    if (!draft) return
    const next = draft.items.filter((_, idx) => idx !== i)
    setDraft({ ...draft, items: next.length ? next : [{ ...emptyItem }] })
  }

  const draftTotals = draft ? computeTotals(draftToQuote(draft)) : null

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Cotizaciones</h2>
          <p>
            Crea cotizaciones de equipos e insumos a partir de una plantilla base uniforme. Previsualiza, descarga en
            PDF o Word e imprime para enviárselas a tus clientes. La numeración se asigna automáticamente.
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Nueva cotización
        </button>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      {initialQuotations.length > 0 && (
        <div className="admin-search">
          <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, cliente, asunto o preparador…"
            aria-label="Buscar cotizaciones"
          />
          {query ? <span className="admin-search-count">{filtered.length}</span> : null}
        </div>
      )}

      {initialQuotations.length === 0 ? (
        <div className="admin-empty">Aún no hay cotizaciones. Crea la primera desde la plantilla base.</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No hay cotizaciones que coincidan con “{query}”.</div>
      ) : (
        <div className="cot-list">
          {filtered.map((q) => {
            const totals = computeTotals(q)
            return (
              <div className="cot-card" key={q.id}>
                <div className="cot-card-main">
                  <div className="cot-card-badge">
                    <span className="cot-card-badge-label">COT</span>
                    <span className="cot-card-badge-num">{q.number.replace(/^COT-/, "")}</span>
                  </div>
                  <div className="cot-card-info">
                    <h3>{q.clientName || "Sin cliente"}</h3>
                    {q.title ? <span className="cot-card-sub">{q.title}</span> : null}
                    <span className="cot-card-meta">
                      {formatLongDate(q.createdAt)} · {q.items.length} {q.items.length === 1 ? "artículo" : "artículos"}
                    </span>
                  </div>
                  <div className="cot-card-total">
                    <span className="cot-card-total-label">Total</span>
                    <span className="cot-card-total-value">{formatMoney(totals.total, q.currency)}</span>
                  </div>
                </div>
                <div className="cot-card-actions">
                  <button className="admin-btn admin-btn-sm" onClick={() => setPreview(q)}>
                    Vista previa
                  </button>
                  <button
                    className="admin-btn admin-btn-sm admin-btn-ghost"
                    disabled={exporting === `pdf-${q.id}`}
                    onClick={() => downloadPdf(q)}
                  >
                    {exporting === `pdf-${q.id}` ? "Generando…" : "PDF"}
                  </button>
                  <button
                    className="admin-btn admin-btn-sm admin-btn-ghost"
                    disabled={exporting === `word-${q.id}`}
                    onClick={() => downloadWord(q)}
                  >
                    {exporting === `word-${q.id}` ? "Generando…" : "Word"}
                  </button>
                  <button className="admin-btn admin-btn-sm" onClick={() => openEdit(q)}>
                    Editar
                  </button>
                  <button
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    disabled={busyId === q.id}
                    onClick={() => remove(q)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor modal */}
      {draft && (
        <div className="admin-modal-overlay" onClick={() => !saving && setDraft(null)}>
          <form className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>
              {draft.id == null ? "Nueva cotización" : `Editar cotización ${draft.number}`}
            </h3>
            <p className="admin-lang-note">
              El número de cotización se asigna automáticamente ({draft.id == null ? "COT-AÑO-000 al guardar" : draft.number}). Las secciones vacías se omiten en el PDF y el Word.
            </p>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Cliente / Empresa *</span>
                <input
                  value={draft.clientName}
                  placeholder="Hospital General…"
                  onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Persona de contacto</span>
                <input
                  value={draft.clientContact}
                  placeholder="Dra. María Pérez"
                  onChange={(e) => setDraft({ ...draft, clientContact: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Correo del cliente</span>
                <input
                  type="email"
                  value={draft.clientEmail}
                  placeholder="compras@empresa.com"
                  onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Teléfono del cliente</span>
                <input
                  value={draft.clientPhone}
                  placeholder="809-000-0000"
                  onChange={(e) => setDraft({ ...draft, clientPhone: e.target.value })}
                />
              </label>
              <label className="admin-field admin-col-2">
                <span>Asunto / Referencia</span>
                <input
                  value={draft.title}
                  placeholder="Suministro de equipos de laboratorio"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Preparado por</span>
                <input
                  value={draft.preparedBy}
                  placeholder="Ing. Juan Camacho"
                  onChange={(e) => setDraft({ ...draft, preparedBy: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Contacto del preparador</span>
                <input
                  value={draft.preparedByContact}
                  placeholder="829-000-0000 · ventas@camvexrd.com"
                  onChange={(e) => setDraft({ ...draft, preparedByContact: e.target.value })}
                />
              </label>
            </div>

            {/* Items */}
            <div className="ficha-editor-section">
              <div className="ficha-editor-head">
                <span>Artículos</span>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={addItem}>
                  + Agregar artículo
                </button>
              </div>
              {draft.items.map((it, i) => (
                <div className="cot-item-row" key={i}>
                  <div className="cot-item-index">{i + 1}</div>
                  <div className="cot-item-image">
                    <ImageUpload
                      label="Imagen"
                      value={it.image}
                      onChange={(url) => setItem(i, "image", url)}
                    />
                  </div>
                  <div className="cot-item-fields">
                    <label className="admin-field">
                      <span>Descripción</span>
                      <textarea
                        rows={2}
                        value={it.description}
                        placeholder="Equipo / insumo y detalles relevantes"
                        onChange={(e) => setItem(i, "description", e.target.value)}
                      />
                    </label>
                    <div className="cot-item-nums">
                      <label className="admin-field">
                        <span>Cantidad</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={it.quantity}
                          onChange={(e) => setItem(i, "quantity", e.target.value === "" ? 0 : Number(e.target.value))}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Precio unitario ({draft.currency === "USD" ? "US$" : "RD$"})</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => setItem(i, "unitPrice", e.target.value === "" ? 0 : Number(e.target.value))}
                        />
                      </label>
                      <div className="admin-field cot-item-linetotal">
                        <span>Subtotal</span>
                        <div className="cot-item-linetotal-value">{formatMoney(lineTotal(it), draft.currency)}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ficha-row-del cot-item-del"
                    onClick={() => removeItem(i)}
                    aria-label="Eliminar artículo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Currency + tax + validity */}
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Moneda</span>
                <select
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value === "USD" ? "USD" : "DOP" })}
                >
                  <option value="DOP">Peso dominicano (RD$)</option>
                  <option value="USD">Dólar estadounidense (US$)</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Validez (días)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.validityDays}
                  onChange={(e) => setDraft({ ...draft, validityDays: e.target.value === "" ? 0 : Number(e.target.value) })}
                />
              </label>
              <label className="admin-field admin-checkbox-field">
                <input
                  type="checkbox"
                  checked={draft.taxEnabled}
                  onChange={(e) => setDraft({ ...draft, taxEnabled: e.target.checked })}
                />
                <span>Aplicar ITBIS</span>
              </label>
              <label className="admin-field">
                <span>Tasa de impuesto (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.taxRate}
                  disabled={!draft.taxEnabled}
                  onChange={(e) => setDraft({ ...draft, taxRate: e.target.value === "" ? 0 : Number(e.target.value) })}
                />
              </label>
              <label className="admin-field admin-col-2">
                <span>Notas y condiciones</span>
                <textarea
                  rows={3}
                  value={draft.notes}
                  placeholder="Condiciones de pago, tiempo de entrega, garantía…"
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </div>

            {/* Live totals */}
            {draftTotals && (
              <div className="cot-editor-totals">
                <div className="cot-editor-total-row">
                  <span>Subtotal</span>
                  <strong>{formatMoney(draftTotals.subtotal, draft.currency)}</strong>
                </div>
                {draft.taxEnabled ? (
                  <div className="cot-editor-total-row">
                    <span>ITBIS ({draft.taxRate}%)</span>
                    <strong>{formatMoney(draftTotals.tax, draft.currency)}</strong>
                  </div>
                ) : null}
                <div className="cot-editor-total-row cot-editor-grand">
                  <span>Total</span>
                  <strong>{formatMoney(draftTotals.total, draft.currency)}</strong>
                </div>
              </div>
            )}

            {error && <div className="admin-note err">{error}</div>}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setPreview(draftToQuote(draft))}
              >
                Vista previa
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cotización"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview overlay */}
      {preview && (
        <div className="ficha-preview-overlay" onClick={() => setPreview(null)}>
          <div className="ficha-preview-box" onClick={(e) => e.stopPropagation()}>
            <div className="ficha-preview-bar">
              <span>Vista previa · {preview.number}</span>
              <div className="ficha-preview-bar-actions">
                <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => downloadPdf(preview)}>
                  Descargar PDF
                </button>
                <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => downloadWord(preview)}>
                  Descargar Word
                </button>
                <button className="admin-btn admin-btn-sm" onClick={() => setPreview(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="ficha-preview-frame">
              <CotizacionPreview quote={preview} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
