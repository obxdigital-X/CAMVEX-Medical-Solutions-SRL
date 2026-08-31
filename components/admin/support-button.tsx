"use client"

import { useState } from "react"

// Owner WhatsApp number in full international format (no +, spaces or dashes).
// Dominican Republic country code (1) + 8295999997.
const WHATSAPP_NUMBER = "18295999997"

/**
 * "Soporte técnico" button shown in the admin sidebar for every panel user.
 * Opens a modal to compose a modification/adjustment request, then hands the
 * message off to WhatsApp via a wa.me deep link (no API token required).
 */
export function SupportButton({ defaultName }: { defaultName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    // Reset transient state after the closing animation.
    setTimeout(() => {
      setError(null)
      setReason("")
      setName(defaultName)
    }, 150)
  }

  // Build the prewritten WhatsApp message from the form fields.
  const message = `Solicitud de soporte técnico — CAMVEX\n\nNombre: ${name.trim() || "(sin nombre)"}\nMotivo de la solicitud:\n${reason.trim()}`
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

  function handleSend(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!reason.trim()) {
      e.preventDefault()
      setError("Describe el motivo de tu solicitud antes de enviar.")
      return
    }
    // Let the browser open WhatsApp in a new tab, then close the modal.
    close()
  }

  return (
    <>
      <button type="button" className="admin-support-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden="true" className="admin-support-icon">
          {/* Lifebuoy / support glyph */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3.5" />
            <line x1="14.5" y1="9.5" x2="18.4" y2="5.6" />
            <line x1="5.6" y1="18.4" x2="9.5" y2="14.5" />
            <line x1="14.5" y1="14.5" x2="18.4" y2="18.4" />
            <line x1="5.6" y1="5.6" x2="9.5" y2="9.5" />
          </svg>
        </span>
        Soporte técnico
      </button>

      {open && (
        <div className="admin-modal-overlay" onClick={close}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Solicitud a soporte técnico">
            <h3>Solicitud a soporte técnico</h3>
            <p className="admin-support-lead">
              ¿Necesitas una modificación o ajuste al sistema? Completa los datos y se abrirá WhatsApp con tu solicitud
              lista para enviar.
            </p>

            <div className="admin-form-grid">
              <label className="admin-field admin-col-2">
                <span>Nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={80}
                />
              </label>

              <label className="admin-field admin-col-2">
                <span>
                  Motivo de la solicitud
                  <em className="admin-char-count">{reason.length}/500</em>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="Describe el cambio o ajuste que necesitas…"
                  rows={5}
                  maxLength={500}
                />
              </label>
            </div>

            {error && <div className="admin-note err">{error}</div>}

            <div className="admin-support-sla" role="note">
              <span aria-hidden="true" className="admin-support-clock">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              </span>
              <span>
                Respuesta dentro de <b>24 horas laborales</b>, de lunes a viernes, de <b>8:00 a.m. a 6:00 p.m.</b>
              </span>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={close}>
                Cancelar
              </button>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-whatsapp"
                onClick={handleSend}
              >
                <span aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.31-.01-.47-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
                  </svg>
                </span>
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
