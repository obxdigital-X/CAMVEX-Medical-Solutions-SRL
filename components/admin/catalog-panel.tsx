"use client"

import "flag-icons/css/flag-icons.min.css"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  type EquipmentItem,
  type EquipmentTranslationFields,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentTranslation,
  saveEquipmentTranslation,
} from "@/app/admin/actions/equipment"
import { LANGS, LANG_META, DEFAULT_LANG, type Lang } from "@/lib/i18n"
import { ImageUpload } from "./image-upload"

type Draft = {
  id: number | null
  name: string
  category: string
  description: string
  image: string
  tag: string
  specsText: string
  active: boolean
}

type TrDraft = {
  name: string
  category: string
  description: string
  specsText: string
}

const emptyDraft: Draft = {
  id: null,
  name: "",
  category: "",
  description: "",
  image: "",
  tag: "",
  specsText: "",
  active: true,
}

export function CatalogPanel({ initialEquipment }: { initialEquipment: EquipmentItem[] }) {
  const router = useRouter()
  const [items] = useState<EquipmentItem[]>(initialEquipment)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? items.filter((it) =>
        [it.name, it.category, it.description, it.tag].join(" ").toLowerCase().includes(needle),
      )
    : items

  // Language being edited inside the modal, plus the translation draft + loading flag.
  const [modalLang, setModalLang] = useState<Lang>(DEFAULT_LANG)
  const [trDraft, setTrDraft] = useState<TrDraft | null>(null)
  const [trLoading, setTrLoading] = useState(false)

  function openCreate() {
    setError(null)
    setModalLang(DEFAULT_LANG)
    setTrDraft(null)
    setDraft({ ...emptyDraft })
  }

  function openEdit(item: EquipmentItem) {
    setError(null)
    setModalLang(DEFAULT_LANG)
    setTrDraft(null)
    setDraft({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      image: item.image,
      tag: item.tag,
      specsText: item.specs.join(", "),
      active: item.active,
    })
  }

  // Switch the language tab inside the modal. Spanish uses the base draft;
  // other languages lazy-load their translation from the server.
  async function switchModalLang(next: Lang) {
    if (next === modalLang || !draft || draft.id == null) return
    setError(null)
    setModalLang(next)
    if (next === DEFAULT_LANG) {
      setTrDraft(null)
      return
    }
    setTrLoading(true)
    const tr: EquipmentTranslationFields = await getEquipmentTranslation(draft.id, next)
    setTrDraft({
      name: tr.name,
      category: tr.category,
      description: tr.description,
      specsText: tr.specs.join(", "),
    })
    setTrLoading(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setSaving(true)
    setError(null)

    // Editing a translation (non-Spanish tab).
    if (draft.id != null && modalLang !== DEFAULT_LANG && trDraft) {
      const specs = trDraft.specsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await saveEquipmentTranslation({
        equipmentId: draft.id,
        lang: modalLang,
        name: trDraft.name,
        category: trDraft.category,
        description: trDraft.description,
        specs,
      })
      setSaving(false)
      if (!res.ok) {
        setError(res.error || "No se pudo guardar la traducción.")
        return
      }
      setNote({ type: "ok", text: `Traducción (${LANG_META[modalLang].label}) guardada.` })
      setDraft(null)
      router.refresh()
      return
    }

    // Editing the base (Spanish) row.
    const specs = draft.specsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const payload = {
      name: draft.name,
      category: draft.category,
      description: draft.description,
      image: draft.image,
      tag: draft.tag,
      specs,
    }
    const res =
      draft.id == null
        ? await createEquipment(payload)
        : await updateEquipment({ ...payload, id: draft.id, active: draft.active })
    setSaving(false)
    if (!res.ok) {
      setError(res.error || "No se pudo guardar.")
      return
    }
    setNote({ type: "ok", text: draft.id == null ? "Equipo agregado." : "Equipo actualizado." })
    setDraft(null)
    router.refresh()
  }

  async function remove(item: EquipmentItem) {
    if (!confirm(`¿Eliminar "${item.name}" del catálogo? Esta acción no se puede deshacer.`)) return
    setBusyId(item.id)
    const res = await deleteEquipment(item.id)
    setBusyId(null)
    if (!res.ok) {
      setNote({ type: "err", text: res.error || "No se pudo eliminar." })
      return
    }
    setNote({ type: "ok", text: "Equipo eliminado." })
    router.refresh()
  }

  async function toggleActive(item: EquipmentItem) {
    setBusyId(item.id)
    const res = await updateEquipment({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      image: item.image,
      tag: item.tag,
      specs: item.specs,
      active: !item.active,
    })
    setBusyId(null)
    if (!res.ok) {
      setNote({ type: "err", text: res.error || "No se pudo actualizar." })
      return
    }
    router.refresh()
  }

  const editingTranslation = draft?.id != null && modalLang !== DEFAULT_LANG

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Catálogo</h2>
          <p>Gestiona los equipos del sitio. Los cambios se reflejan de inmediato en la página pública.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Agregar equipo
        </button>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      {items.length > 0 && (
        <div className="admin-search">
          <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría, modelo o descripción…"
            aria-label="Buscar equipos"
          />
          {query ? <span className="admin-search-count">{filtered.length}</span> : null}
        </div>
      )}

      {items.length === 0 ? (
        <div className="admin-empty">Aún no hay equipos. Agrega el primero.</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No hay equipos que coincidan con “{query}”.</div>
      ) : (
        <div className="admin-cat-grid">
          {filtered.map((item) => (
            <div className={`admin-cat-card${item.active ? "" : " is-inactive"}`} key={item.id}>
              <div className="admin-cat-media">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image || "/placeholder.svg"} alt={item.name} />
                ) : (
                  <div className="admin-cat-noimg">Sin imagen</div>
                )}
                {item.tag ? <span className="admin-cat-tag">{item.tag}</span> : null}
                {!item.active ? <span className="admin-cat-hidden">Oculto</span> : null}
              </div>
              <div className="admin-cat-info">
                <h3>{item.name}</h3>
                {item.category ? <span className="admin-cat-cat">{item.category}</span> : null}
                <p>{item.description}</p>
                {item.specs.length > 0 && (
                  <div className="admin-cat-specs">
                    {item.specs.map((sp) => (
                      <span key={sp}>{sp}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-cat-actions">
                <button className="admin-btn admin-btn-sm" onClick={() => openEdit(item)}>
                  Editar
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-ghost"
                  disabled={busyId === item.id}
                  onClick={() => toggleActive(item)}
                >
                  {item.active ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  disabled={busyId === item.id}
                  onClick={() => remove(item)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="admin-modal-overlay" onClick={() => !saving && setDraft(null)}>
          <form className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{draft.id == null ? "Agregar equipo" : "Editar equipo"}</h3>

            {draft.id == null ? (
              <p className="admin-lang-note">
                Primero crea el equipo en español. Luego podrás editar sus traducciones a otros idiomas.
              </p>
            ) : (
              <div className="admin-lang-tabs">
                {LANGS.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className={`admin-lang-tab${modalLang === l ? " active" : ""}`}
                    onClick={() => switchModalLang(l)}
                    disabled={saving}
                  >
                    <span className={`fi fi-${LANG_META[l].flag}`} />
                    {LANG_META[l].label}
                    {l === DEFAULT_LANG ? " (base)" : ""}
                  </button>
                ))}
              </div>
            )}

            {trLoading ? (
              <div className="admin-lang-loading">Cargando traducción…</div>
            ) : editingTranslation && trDraft ? (
              <>
                <p className="admin-lang-note">
                  Deja un campo vacío para usar automáticamente el texto en español. Imagen, modelo/tag y estado se
                  gestionan solo desde la versión base.
                </p>
                <div className="admin-form-grid">
                  <label className="admin-field admin-col-2">
                    <span>Nombre</span>
                    <input
                      value={trDraft.name}
                      placeholder={draft.name}
                      onChange={(e) => setTrDraft({ ...trDraft, name: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-col-2">
                    <span>Categoría</span>
                    <input
                      value={trDraft.category}
                      placeholder={draft.category}
                      onChange={(e) => setTrDraft({ ...trDraft, category: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-col-2">
                    <span>Descripción</span>
                    <textarea
                      rows={3}
                      value={trDraft.description}
                      placeholder={draft.description}
                      onChange={(e) => setTrDraft({ ...trDraft, description: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-col-2">
                    <span>Especificaciones (separadas por coma)</span>
                    <input
                      value={trDraft.specsText}
                      placeholder={draft.specsText}
                      onChange={(e) => setTrDraft({ ...trDraft, specsText: e.target.value })}
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="admin-form-grid">
                <label className="admin-field admin-col-2">
                  <span>Nombre *</span>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </label>
                <label className="admin-field">
                  <span>Modelo / Tag</span>
                  <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
                </label>
                <label className="admin-field">
                  <span>Categoría</span>
                  <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                </label>
                <label className="admin-field admin-col-2">
                  <span>Descripción</span>
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              <div className="admin-field admin-col-2">
                <ImageUpload
                  label="Imagen del equipo"
                  value={draft.image}
                  onChange={(url) => setDraft((d) => (d ? { ...d, image: url } : d))}
                />
              </div>
                <label className="admin-field admin-col-2">
                  <span>Especificaciones (separadas por coma)</span>
                  <input
                    value={draft.specsText}
                    placeholder="160 T/H, Refrigerado, Auto"
                    onChange={(e) => setDraft({ ...draft, specsText: e.target.value })}
                  />
                </label>
              </div>
            )}

            {error && <div className="admin-note err">{error}</div>}

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || trLoading}>
                {saving ? "Guardando…" : editingTranslation ? "Guardar traducción" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
