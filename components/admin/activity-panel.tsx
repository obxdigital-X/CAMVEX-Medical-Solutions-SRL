"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { clearActivity, listActivity, type ActivityEntry } from "@/app/admin/actions/activity"

const ACTION_LABEL: Record<string, string> = {
  created: "Creó",
  updated: "Editó",
  deleted: "Eliminó",
  login: "Inició sesión",
  logout: "Cerró sesión",
}

// Every module that can appear in the log, used for the filter row.
const MODULES = ["Accesos", "Catálogo", "Fichas técnicas", "Cotizaciones", "Mensajes", "Usuarios", "Textos del sitio"]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Human-friendly relative time in Spanish (e.g. "hace 5 min").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const days = Math.floor(hr / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short" })
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ActivityPanel({ initialActivity }: { initialActivity: ActivityEntry[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [moduleFilter, setModuleFilter] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Live audit trail: SWR polls every 15s and refetches when the admin returns
  // to the tab, so logins and changes made from other users' devices appear
  // without a full page reload. `initialActivity` (from the server) seeds the
  // first render so there is no loading flash.
  const { data, isValidating, mutate } = useSWR<ActivityEntry[]>("admin-activity", () => listActivity(), {
    fallbackData: initialActivity,
    refreshInterval: 15000,
    revalidateOnFocus: true,
  })
  const activity = data ?? initialActivity

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return activity.filter((e) => {
      if (moduleFilter && e.entity !== moduleFilter) return false
      if (!needle) return true
      return [e.actorName, e.actorUsername, e.entity, e.summary].join(" ").toLowerCase().includes(needle)
    })
  }, [activity, query, moduleFilter])

  async function handleClear(olderThanDays?: number) {
    const label = olderThanDays
      ? "¿Eliminar los registros con más de 30 días?"
      : "¿Borrar TODO el historial de actividad? Esta acción no se puede deshacer."
    if (!window.confirm(label)) return
    setBusy(true)
    setNote(null)
    try {
      await clearActivity(olderThanDays)
      setNote({ type: "ok", text: "Historial actualizado." })
      await mutate()
      router.refresh()
    } catch {
      setNote({ type: "err", text: "No se pudo actualizar el historial." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Caché</h2>
          <p>
            Registro de auditoría de todos los cambios hechos por los usuarios del panel: entradas y salidas,
            creaciones, ediciones y eliminaciones en cada módulo. Se actualiza automáticamente. Solo el administrador
            puede verlo.
          </p>
        </div>
        <div className="cache-head-actions">
          <button className="admin-btn" onClick={() => mutate()} disabled={isValidating}>
            <span className={`cache-live-dot ${isValidating ? "is-syncing" : ""}`} aria-hidden="true" />
            {isValidating ? "Actualizando…" : "Actualizar"}
          </button>
          <button className="admin-btn" onClick={() => handleClear(30)} disabled={busy || activity.length === 0}>
            Limpiar +30 días
          </button>
          <button
            className="admin-btn admin-btn-danger"
            onClick={() => handleClear()}
            disabled={busy || activity.length === 0}
          >
            Borrar todo
          </button>
        </div>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      {activity.length > 0 && (
        <>
          <div className="admin-search">
            <svg className="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por usuario, módulo o descripción…"
              aria-label="Buscar en el historial"
            />
            {query ? <span className="admin-search-count">{filtered.length}</span> : null}
          </div>

          <div className="cache-filters">
            <button
              className={`cache-chip ${moduleFilter === null ? "active" : ""}`}
              onClick={() => setModuleFilter(null)}
            >
              Todos
            </button>
            {MODULES.map((m) => (
              <button
                key={m}
                className={`cache-chip ${moduleFilter === m ? "active" : ""}`}
                onClick={() => setModuleFilter(moduleFilter === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {activity.length === 0 ? (
        <div className="admin-empty">Aún no hay actividad registrada. Los cambios en el panel aparecerán aquí.</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No hay registros que coincidan con el filtro.</div>
      ) : (
        <ul className="cache-timeline">
          {filtered.map((e) => (
            <li className="cache-item" key={e.id}>
              <div className={`cache-avatar ${e.actorRole === "admin" ? "is-admin" : ""}`} aria-hidden="true">
                {initials(e.actorName)}
              </div>
              <div className="cache-body">
                <div className="cache-line">
                  <span className="cache-actor">{e.actorName || "Usuario"}</span>
                  {e.actorRole === "admin" ? <span className="cache-role">Admin</span> : null}
                  <span className={`cache-action cache-action-${e.action}`}>{ACTION_LABEL[e.action] ?? e.action}</span>
                  <span className="cache-entity">{e.entity}</span>
                </div>
                <p className="cache-summary">{e.summary}</p>
              </div>
              <time className="cache-time" dateTime={e.createdAt} title={fullDate(e.createdAt)}>
                {relativeTime(e.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
