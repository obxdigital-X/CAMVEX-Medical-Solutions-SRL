"use client"

import type React from "react"
import { useState } from "react"
import { changeMyPassword } from "@/app/admin/actions/users"

// Eye toggle matching the rest of the admin password fields.
function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="admin-password-toggle"
      onClick={onToggle}
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      tabIndex={-1}
    >
      {shown ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.45 18.45 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}

export function ChangeMyPassword() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setCurrent("")
    setNext("")
    setConfirm("")
    setShowCurrent(false)
    setShowNext(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (next !== confirm) {
      setError("La confirmación no coincide con la nueva contraseña.")
      return
    }
    setSaving(true)
    const res = await changeMyPassword({ currentPassword: current, newPassword: next })
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? "No se pudo cambiar la contraseña.")
      return
    }
    setOkMsg("Tu contraseña fue actualizada correctamente.")
    close()
    setTimeout(() => setOkMsg(null), 4000)
  }

  return (
    <>
      <button className="admin-change-pw" onClick={() => setOpen(true)}>
        Cambiar mi contraseña
      </button>

      {okMsg && <div className="admin-toast-ok">{okMsg}</div>}

      {open && (
        <div className="admin-modal-overlay" onClick={close}>
          <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h3>Cambiar mi contraseña</h3>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--slate)" }}>
              Ingresa tu contraseña actual y define una nueva.
            </p>

            {error && <div className="admin-note err">{error}</div>}

            <label className="admin-field">
              <span>Contraseña actual</span>
              <div className="admin-password-wrap">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <EyeToggle shown={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
              </div>
            </label>

            <label className="admin-field">
              <span>Nueva contraseña (mínimo 8 caracteres)</span>
              <div className="admin-password-wrap">
                <input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <EyeToggle shown={showNext} onToggle={() => setShowNext((v) => !v)} />
              </div>
            </label>

            <label className="admin-field">
              <span>Confirmar nueva contraseña</span>
              <div className="admin-password-wrap">
                <input
                  type={showNext ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={close}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Actualizar contraseña"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
