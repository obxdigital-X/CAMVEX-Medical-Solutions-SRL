"use client"

import type React from "react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { saveAs } from "file-saver"
import {
  type DataSheet,
  type DataSheetInput,
  createDataSheet,
  updateDataSheet,
  deleteDataSheet,
} from "@/app/admin/actions/data-sheets"
import { ImageUpload } from "./image-upload"

// HTML replica of the ficha. Loaded client-side (it resolves images to data
// URLs in the browser). Not an embedded PDF, so Chrome won't block it.
const FichaPreview = dynamic(() => import("./ficha/ficha-preview"), {
  ssr: false,
  loading: () => <div className="ficha-preview-loading">Cargando vista previa…</div>,
})

type Draft = DataSheetInput & { id: number | null }

const emptyDraft: Draft = {
  id: null,
  title: "",
  subtitle: "",
  intro: "",
  image: "",
  formula: "",
  manufacturer: "",
  presentation: "",
  characteristics: [""],
  specs: [{ param: "", value: "" }],
  applications: [""],
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "ficha-tecnica"
  )
}

// Turns a draft into the shape the PDF/Word template expects (a full DataSheet).
function draftToSheet(d: Draft): DataSheet {
  return {
    id: d.id ?? 0,
    title: d.title,
    subtitle: d.subtitle,
    intro: d.intro,
    image: d.image,
    formula: d.formula,
    manufacturer: d.manufacturer,
    presentation: d.presentation,
    characteristics: d.characteristics.map((s) => s.trim()).filter(Boolean),
    specs: d.specs.map((r) => ({ param: r.param.trim(), value: r.value.trim() })).filter((r) => r.param || r.value),
    applications: d.applications.map((s) => s.trim()).filter(Boolean),
    createdAt: "",
    updatedAt: "",
  }
}

export function DataSheetsPanel({ initialSheets }: { initialSheets: DataSheet[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState<DataSheet | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? initialSheets.filter((s) =>
        [s.title, s.subtitle, s.manufacturer, s.formula].join(" ").toLowerCase().includes(needle),
      )
    : initialSheets

  function openCreate() {
    setError(null)
    setDraft({ ...emptyDraft, characteristics: [""], specs: [{ param: "", value: "" }], applications: [""] })
  }

  function openEdit(s: DataSheet) {
    setError(null)
    setDraft({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      intro: s.intro,
      image: s.image,
      formula: s.formula,
      manufacturer: s.manufacturer,
      presentation: s.presentation,
      characteristics: s.characteristics.length ? s.characteristics : [""],
      specs: s.specs.length ? s.specs : [{ param: "", value: "" }],
      applications: s.applications.length ? s.applications : [""],
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (!draft.title.trim()) {
      setError("El nombre del producto es obligatorio.")
      return
    }
    setSaving(true)
    setError(null)
    const payload: DataSheetInput = {
      title: draft.title,
      subtitle: draft.subtitle,
      intro: draft.intro,
      image: draft.image,
      formula: draft.formula,
      manufacturer: draft.manufacturer,
      presentation: draft.presentation,
      characteristics: draft.characteristics,
      specs: draft.specs,
      applications: draft.applications,
    }
    const res = draft.id == null ? await createDataSheet(payload) : await updateDataSheet({ ...payload, id: draft.id })
    setSaving(false)
    if (!res.ok) {
      setError(res.error || "No se pudo guardar la ficha.")
      return
    }
    setNote({ type: "ok", text: draft.id == null ? "Ficha creada." : "Ficha actualizada." })
    setDraft(null)
    router.refresh()
  }

  async function remove(s: DataSheet) {
    if (!confirm(`¿Eliminar la ficha técnica de "${s.title}"? Esta acción no se puede deshacer.`)) return
    setBusyId(s.id)
    const res = await deleteDataSheet(s.id)
    setBusyId(null)
    if (!res.ok) {
      setNote({ type: "err", text: res.error || "No se pudo eliminar." })
      return
    }
    setNote({ type: "ok", text: "Ficha eliminada." })
    router.refresh()
  }

  async function downloadPdf(sheet: DataSheet) {
    setExporting(`pdf-${sheet.id}`)
    try {
      const [{ pdf }, { FichaPdfDocument }, { resolveFichaImages }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./ficha/ficha-pdf"),
        import("./ficha/ficha-assets"),
      ])
      const { logo, image } = await resolveFichaImages(sheet.image)
      const blob = await pdf(<FichaPdfDocument sheet={sheet} logo={logo} image={image} />).toBlob()
      saveAs(blob, `ficha-tecnica-${slugify(sheet.title)}.pdf`)
    } catch {
      setNote({ type: "err", text: "No se pudo generar el PDF." })
    } finally {
      setExporting(null)
    }
  }

  async function downloadWord(sheet: DataSheet) {
    setExporting(`word-${sheet.id}`)
    try {
      const { buildFichaDocx } = await import("./ficha/ficha-word")
      const blob = await buildFichaDocx(sheet)
      saveAs(blob, `ficha-tecnica-${slugify(sheet.title)}.docx`)
    } catch {
      setNote({ type: "err", text: "No se pudo generar el documento de Word." })
    } finally {
      setExporting(null)
    }
  }

  // ----- dynamic list helpers (operate on the current draft) -----
  function setList<K extends "characteristics" | "applications">(key: K, i: number, value: string) {
    if (!draft) return
    const next = [...draft[key]]
    next[i] = value
    setDraft({ ...draft, [key]: next })
  }
  function addList(key: "characteristics" | "applications") {
    if (!draft) return
    setDraft({ ...draft, [key]: [...draft[key], ""] })
  }
  function removeList(key: "characteristics" | "applications", i: number) {
    if (!draft) return
    const next = draft[key].filter((_, idx) => idx !== i)
    setDraft({ ...draft, [key]: next.length ? next : [""] })
  }
  function setSpec(i: number, field: "param" | "value", value: string) {
    if (!draft) return
    const next = draft.specs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    setDraft({ ...draft, specs: next })
  }
  function addSpec() {
    if (!draft) return
    setDraft({ ...draft, specs: [...draft.specs, { param: "", value: "" }] })
  }
  function removeSpec(i: number) {
    if (!draft) return
    const next = draft.specs.filter((_, idx) => idx !== i)
    setDraft({ ...draft, specs: next.length ? next : [{ param: "", value: "" }] })
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Fichas técnicas</h2>
          <p>
            Crea fichas técnicas de productos a partir de una plantilla base uniforme.Previsualiza y descarga en PDF o Word. Los cambios se guardan automáticamente al crear o editar.
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Nueva ficha técnica
        </button>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      {initialSheets.length > 0 && (
        <div className="admin-search">
          <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, subtítulo, fabricante o fórmula…"
            aria-label="Buscar fichas técnicas"
          />
          {query ? <span className="admin-search-count">{filtered.length}</span> : null}
        </div>
      )}

      {initialSheets.length === 0 ? (
        <div className="admin-empty">Aún no hay fichas técnicas. Crea la primera desde la plantilla base.</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No hay fichas que coincidan con “{query}”.</div>
      ) : (
        <div className="ficha-list">
          {filtered.map((s) => (
            <div className="ficha-card" key={s.id}>
              <div className="ficha-card-main">
                <div className="ficha-card-thumb">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image || "/placeholder.svg"} alt={s.title} />
                  ) : (
                    <span>FT</span>
                  )}
                </div>
                <div className="ficha-card-info">
                  <h3>{s.title}</h3>
                  {s.subtitle ? <span className="ficha-card-sub">{s.subtitle}</span> : null}
                  <span className="ficha-card-meta">
                    {s.specs.length} especificaciones · {s.characteristics.length} características
                  </span>
                </div>
              </div>
              <div className="ficha-card-actions">
                <button className="admin-btn admin-btn-sm" onClick={() => setPreview(s)}>
                  Vista previa
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-ghost"
                  disabled={exporting === `pdf-${s.id}`}
                  onClick={() => downloadPdf(s)}
                >
                  {exporting === `pdf-${s.id}` ? "Generando…" : "PDF"}
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-ghost"
                  disabled={exporting === `word-${s.id}`}
                  onClick={() => downloadWord(s)}
                >
                  {exporting === `word-${s.id}` ? "Generando…" : "Word"}
                </button>
                <button className="admin-btn admin-btn-sm" onClick={() => openEdit(s)}>
                  Editar
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  disabled={busyId === s.id}
                  onClick={() => remove(s)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {draft && (
        <div className="admin-modal-overlay" onClick={() => !saving && setDraft(null)}>
          <form className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{draft.id == null ? "Nueva ficha técnica" : "Editar ficha técnica"}</h3>
            <p className="admin-lang-note">
              Todos los campos siguen la misma plantilla base. Las secciones sin contenido se omiten automáticamente en
              el PDF y el Word.
            </p>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Nombre del producto *</span>
                <input
                  value={draft.title}
                  maxLength={70}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Línea de uso / subtítulo</span>
                <input
                  value={draft.subtitle}
                  placeholder="Uso laboratorio"
                  maxLength={50}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                />
              </label>
              <label className="admin-field admin-col-2">
                <span>
                  Descripción / introducción
                  <em className="admin-char-count">{draft.intro.length}/300</em>
                </span>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={draft.intro}
                  onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
                />
              </label>
              <div className="admin-field admin-col-2">
                <ImageUpload
                  label="Imagen del producto"
                  value={draft.image}
                  onChange={(url) => setDraft((d) => (d ? { ...d, image: url } : d))}
                />
              </div>
              <label className="admin-field">
                <span>Fórmula química</span>
                <input
                  value={draft.formula}
                  placeholder="H₂O"
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, formula: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Fabricante</span>
                <input
                  value={draft.manufacturer}
                  placeholder="Industrias Guilab S.R.L."
                  maxLength={60}
                  onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                />
              </label>
            </div>

            {/* Characteristics */}
            <div className="ficha-editor-section">
              <div className="ficha-editor-head">
                <span>
                  Características <em className="admin-hint">máx. 120 caracteres c/u</em>
                </span>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => addList("characteristics")}>
                  + Agregar
                </button>
              </div>
              {draft.characteristics.map((c, i) => (
                <div className="ficha-row" key={i}>
                  <input
                    value={c}
                    maxLength={120}
                    placeholder="Ej: Líquido incoloro, inodoro e insaboro."
                    onChange={(e) => setList("characteristics", i, e.target.value)}
                  />
                  <button type="button" className="ficha-row-del" onClick={() => removeList("characteristics", i)} aria-label="Eliminar">
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Specifications */}
            <div className="ficha-editor-section">
              <div className="ficha-editor-head">
                <span>
                  Especificaciones técnicas <em className="admin-hint">máx. 45 / 90 caracteres</em>
                </span>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={addSpec}>
                  + Agregar
                </button>
              </div>
              {draft.specs.map((r, i) => (
                <div className="ficha-row ficha-row-spec" key={i}>
                  <input
                    value={r.param}
                    maxLength={45}
                    placeholder="Parámetro (ej: Conductividad)"
                    onChange={(e) => setSpec(i, "param", e.target.value)}
                  />
                  <input
                    value={r.value}
                    maxLength={90}
                    placeholder="Especificación (ej: < 2 mho/cm)"
                    onChange={(e) => setSpec(i, "value", e.target.value)}
                  />
                  <button type="button" className="ficha-row-del" onClick={() => removeSpec(i)} aria-label="Eliminar">
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Presentation + applications */}
            <div className="admin-form-grid">
              <label className="admin-field admin-col-2">
                <span>
                  Presentación
                  <em className="admin-char-count">{draft.presentation.length}/180</em>
                </span>
                <textarea
                  rows={2}
                  maxLength={180}
                  value={draft.presentation}
                  placeholder="Galón o volumen a requerimiento del cliente."
                  onChange={(e) => setDraft({ ...draft, presentation: e.target.value })}
                />
              </label>
            </div>

            <div className="ficha-editor-section">
              <div className="ficha-editor-head">
                <span>
                  Aplicaciones <em className="admin-hint">máx. 40 caracteres c/u</em>
                </span>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => addList("applications")}>
                  + Agregar
                </button>
              </div>
              {draft.applications.map((a, i) => (
                <div className="ficha-row" key={i}>
                  <input
                    value={a}
                    maxLength={40}
                    placeholder="Ej: Hospitalario"
                    onChange={(e) => setList("applications", i, e.target.value)}
                  />
                  <button type="button" className="ficha-row-del" onClick={() => removeList("applications", i)} aria-label="Eliminar">
                    ×
                  </button>
                </div>
              ))}
            </div>

            {error && <div className="admin-note err">{error}</div>}

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPreview(draftToSheet(draft))}>
                Vista previa
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar ficha"}
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
              <span>Vista previa · {preview.title || "Ficha técnica"}</span>
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
              <FichaPreview sheet={preview} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
