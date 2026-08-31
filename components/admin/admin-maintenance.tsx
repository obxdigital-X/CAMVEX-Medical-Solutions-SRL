"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useState } from "react"

const SUPPORT_WHATSAPP = "https://wa.me/18295999997"
const SUPPORT_EMAIL = "oswaldbautistara@gmail.com"

export function AdminMaintenance({ name }: { name: string }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } catch {}
    router.push("/admin")
    router.refresh()
  }

  return (
    <div className="admin-maint">
      <div className="admin-maint-card">
        <span className="admin-maint-logo" aria-hidden="true" />
        <div className="admin-maint-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18v3h3l6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.1-.5-.5-2.1z" />
          </svg>
        </div>

        <p className="admin-maint-kicker">Plataforma administrativa</p>
        <h1 className="admin-maint-title">Sistema en mantenimiento</h1>
        <p className="admin-maint-text">
          Hola {name}, el panel administrativo está temporalmente fuera de servicio por mantenimiento. Por favor
          contacta a soporte.
        </p>

        <div className="admin-maint-actions">
          <a className="admin-btn admin-btn-whatsapp" href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer">
            Contactar soporte por WhatsApp
          </a>
        </div>

        <button className="admin-maint-signout" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  )
}
