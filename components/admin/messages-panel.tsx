"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { type Message, markMessageRead, deleteMessage, markMessageReplied } from "@/app/admin/actions/messages"

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MessagesPanel({ initialMessages }: { initialMessages: Message[] }) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [selected, setSelected] = useState<Message | null>(null)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const visible = filter === "unread" ? messages.filter((m) => !m.read) : messages
  const unreadCount = messages.filter((m) => !m.read).length

  async function open(m: Message) {
    setSelected(m)
    if (!m.read) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)))
      await markMessageRead(m.id, true)
      router.refresh()
    }
  }

  // Opens the WhatsApp conversation with the contact and marks the message as
  // replied. Reply is composed and sent directly inside WhatsApp.
  async function openWhatsApp(m: Message) {
    const to = (m.phone || "").replace(/[^\d]/g, "")
    if (!to) return
    window.open(`https://wa.me/${to}`, "_blank", "noopener,noreferrer")
    const now = new Date().toISOString()
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, replied: true, repliedAt: now, read: true } : x)),
    )
    setSelected((prev) => (prev ? { ...prev, replied: true, repliedAt: now } : prev))
    await markMessageReplied(m.id)
    router.refresh()
  }

  // Manually flip the replied state (e.g. undo if WhatsApp was opened by mistake).
  async function toggleReplied(m: Message) {
    const next = !m.replied
    const now = next ? new Date().toISOString() : null
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, replied: next, repliedAt: now } : x)),
    )
    setSelected((prev) => (prev ? { ...prev, replied: next, repliedAt: now } : prev))
    await markMessageReplied(m.id, next)
    router.refresh()
  }

  async function toggleRead(m: Message, e: React.MouseEvent) {
    e.stopPropagation()
    const next = !m.read
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: next } : x)))
    await markMessageRead(m.id, next)
    router.refresh()
  }

  async function remove(m: Message, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm(`¿Eliminar el mensaje de "${m.name || "sin nombre"}"?`)) return
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    if (selected?.id === m.id) setSelected(null)
    await deleteMessage(m.id)
    router.refresh()
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Mensajes</h2>
          <p>Solicitudes recibidas desde el formulario de contacto del sitio.</p>
        </div>
        <div className="admin-msg-filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            Todos ({messages.length})
          </button>
          <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>
            No leídos ({unreadCount})
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">
          {filter === "unread" ? "No hay mensajes sin leer." : "Aún no se han recibido mensajes."}
        </div>
      ) : (
        <ul className="admin-msg-list">
          {visible.map((m) => (
            <li
              key={m.id}
              className={`admin-msg-item${m.read ? "" : " is-unread"}`}
              onClick={() => open(m)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") open(m)
              }}
            >
              <div className="admin-msg-main">
                <div className="admin-msg-top">
                  {!m.read && <span className="admin-msg-dot" aria-label="No leído" />}
                  <strong>{m.name || "Sin nombre"}</strong>
                  {m.institution && <span className="admin-msg-inst">· {m.institution}</span>}
                </div>
                <p className="admin-msg-preview">{m.message || "(sin mensaje)"}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {m.interest && <span className="admin-chip">{m.interest}</span>}
                  {m.replied && <span className="admin-chip admin-chip-replied">Respondido</span>}
                </div>
              </div>
              <div className="admin-msg-side">
                <time>{formatDate(m.createdAt)}</time>
                <div className="admin-msg-actions">
                  <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={(e) => toggleRead(m, e)}>
                    {m.read ? "Marcar no leído" : "Marcar leído"}
                  </button>
                  <button
                    className="admin-btn admin-btn-sm admin-btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleReplied(m)
                    }}
                  >
                    {m.replied ? "Marcar no respondido" : "Marcar respondido"}
                  </button>
                  <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={(e) => remove(m, e)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Mensaje de {selected.name || "sin nombre"}</h3>
            <dl className="admin-msg-detail">
              {selected.institution && (
                <>
                  <dt>Institución</dt>
                  <dd>{selected.institution}</dd>
                </>
              )}
              {selected.phone && (
                <>
                  <dt>Teléfono</dt>
                  <dd>
                    <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                  </dd>
                </>
              )}
              {selected.interest && (
                <>
                  <dt>Interés</dt>
                  <dd>{selected.interest}</dd>
                </>
              )}
              <dt>Recibido</dt>
              <dd>{formatDate(selected.createdAt)}</dd>
              <dt>Mensaje</dt>
              <dd className="admin-msg-body">{selected.message || "(sin mensaje)"}</dd>
            </dl>

            {selected.replied && (
              <div className="admin-msg-replied">
                <span className="admin-msg-replied-label">
                  Respondido{selected.repliedAt ? ` · ${formatDate(selected.repliedAt)}` : ""}
                </span>
                <button
                  className="admin-msg-replied-undo"
                  type="button"
                  onClick={() => toggleReplied(selected)}
                >
                  Marcar como no respondido
                </button>
              </div>
            )}

            {!selected.phone && (
              <p className="admin-msg-nophone">Este contacto no dejó un número de teléfono para responder.</p>
            )}

            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-danger" type="button" onClick={() => remove(selected)}>
                Eliminar
              </button>
              <button className="admin-btn admin-btn-ghost" type="button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
              {selected.phone && (
                <button
                  className="admin-btn admin-btn-whatsapp"
                  type="button"
                  onClick={() => openWhatsApp(selected)}
                >
                  Responder por WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
