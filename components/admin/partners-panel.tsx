"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  type Partner,
  createPartner,
  updatePartner,
  deletePartner,
  reorderPartners,
} from "@/app/admin/actions/partners"
import { ImageUpload } from "./image-upload"

type Draft = {
  id: number | null
  name: string
  image: string
  active: boolean
}

const emptyDraft: Draft = { id: null, name: "", image: "", active: true }

export function PartnersPanel({ initialPartners }: { initialPartners: Partner[] }) {
  const router = useRouter()
  // Local, optimistic order so drag / move feels instant before the server round-trips.
  const [items, setItems] = useState<Partner[]>(initialPartners)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)

  function flash(type: "ok" | "err", text: string) {
    setNote({ type, text })
    setTimeout(() => setNote(null), 3000)
  }

  function openCreate() {
    setError(null)
    setDraft({ ...emptyDraft })
  }

  function openEdit(p: Partner) {
    setError(null)
    setDraft({ id: p.id, name: p.name, image: p.image, active: p.active })
  }

  async function save() {
    if (!draft) return
    if (!draft.image.trim()) {
      setError("Debes subir o indicar un logo.")
      return
    }
    setSaving(true)
    setError(null)
    const res = draft.id
      ? await updatePartner({ id: draft.id, name: draft.name, image: draft.image, active: draft.active })
      : await createPartner({ name: draft.name, image: draft.image })
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar.")
      return
    }
    setDraft(null)
    flash("ok", draft.id ? "Aliado actualizado." : "Aliado agregado.")
    router.refresh()
  }

  async function toggleActive(p: Partner) {
    setBusyId(p.id)
    const res = await updatePartner({ id: p.id, name: p.name, image: p.image, active: !p.active })
    setBusyId(null)
    if (!res.ok) {
      flash("err", res.error ?? "No se pudo actualizar.")
      return
    }
    setItems((prev) => prev.map((it) => (it.id === p.id ? { ...it, active: !it.active } : it)))
    flash("ok", p.active ? "Logo oculto del sitio." : "Logo visible en el sitio.")
    router.refresh()
  }

  async function remove(p: Partner) {
    if (!confirm(`¿Eliminar el logo "${p.name || "sin nombre"}"? Esta acción no se puede deshacer.`)) return
    setBusyId(p.id)
    const res = await deletePartner(p.id)
    setBusyId(null)
    if (!res.ok) {
      flash("err", res.error ?? "No se pudo eliminar.")
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== p.id))
    flash("ok", "Logo eliminado.")
    router.refresh()
  }

  // Persist a reordered list to the server.
  async function persistOrder(next: Partner[]) {
    setItems(next)
    const res = await reorderPartners(next.map((p) => p.id))
    if (!res.ok) {
      flash("err", res.error ?? "No se pudo guardar el orden.")
      return
    }
    router.refresh()
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    persistOrder(next)
  }

  // --- Drag and drop reordering ---
  function onDrop(targetId: number) {
    if (dragId == null || dragId === targetId) {
      setDragId(null)
      return
    }
    const from = items.findIndex((p) => p.id === dragId)
    const to = items.findIndex((p) => p.id === targetId)
    if (from === -1 || to === -1) {
      setDragId(null)
      return
    }
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDragId(null)
    persistOrder(next)
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Aliados</h2>
          <p>
            Administra el slider de logos de instituciones aliadas de la página de inicio. Arrastra para reordenar; los
            cambios se reflejan de inmediato en el sitio.
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>
          + Agregar logo
        </button>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      {items.length === 0 ? (
        <div className="admin-empty">Aún no hay aliados. Agrega el primer logo.</div>
      ) : (
        <ul className="partner-admin-list">
          {items.map((p, index) => (
            <li
              key={p.id}
              className={`partner-admin-row ${p.active ? "" : "is-hidden"} ${dragId === p.id ? "is-dragging" : ""}`}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(p.id)}
              onDragEnd={() => setDragId(null)}
            >
              <span className="partner-admin-handle" aria-hidden="true" title="Arrastra para reordenar">
                ⋮⋮
              </span>

              <div className="partner-admin-order">
                <button
                  className="partner-admin-move"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Subir"
                  title="Subir"
                >
                  ▲
                </button>
                <button
                  className="partner-admin-move"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Bajar"
                  title="Bajar"
                >
                  ▼
                </button>
              </div>

              <div className="partner-admin-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image || "/placeholder.svg"} alt={p.name || "Logo aliado"} />
              </div>

              <div className="partner-admin-info">
                <b>{p.name || "Sin nombre"}</b>
                <span className={`partner-admin-status ${p.active ? "on" : "off"}`}>
                  {p.active ? "Visible en el sitio" : "Oculto"}
                </span>
              </div>

              <div className="partner-admin-actions">
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p.id}
                >
                  {p.active ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => openEdit(p)}
                  disabled={busyId === p.id}
                >
                  Editar
                </button>
                <button
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  onClick={() => remove(p)}
                  disabled={busyId === p.id}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="admin-modal-overlay" onClick={() => !saving && setDraft(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? "Editar aliado" : "Agregar aliado"}</h3>

            <div className="admin-form-grid">
              <div className="admin-field admin-col-2">
                <ImageUpload
                  value={draft.image}
                  onChange={(url) => setDraft((d) => (d ? { ...d, image: url } : d))}
                  label="Logo de la institución"
                />
              </div>

              <label className="admin-field admin-col-2">
                <span>Nombre (opcional, para accesibilidad)</span>
                <input
                  value={draft.name}
                  placeholder="Clínica Independencia"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>

              {draft.id != null && (
                <label className="admin-checkbox-field admin-col-2">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  <span>Visible en el sitio</span>
                </label>
              )}
            </div>

            {error && <div className="admin-note err">{error}</div>}

            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-ghost" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </button>
              <button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : draft.id ? "Guardar cambios" : "Agregar logo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
