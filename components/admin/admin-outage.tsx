"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"

const SUPPORT_WHATSAPP = "https://wa.me/18295999997"

export function AdminOutage({ name }: { name: string }) {
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
    <div className="admin-maint admin-outage">
      <div className="admin-maint-card">
        <span className="admin-maint-logo" aria-hidden="true" />
        <div className="admin-maint-icon admin-outage-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3 2.8 20h18.4L12 3Z" />
            <path d="M12 9v5M12 17.2v.1" strokeLinecap="round" />
          </svg>
        </div>
        <p className="admin-maint-kicker">Plataforma administrativa</p>
        <h1 className="admin-maint-title">Panel fuera de servicio</h1>
        <p className="admin-maint-text">
          Hola {name}, el panel administrativo está temporalmente fuera de servicio debido a una interrupción técnica.
          Puede deberse a poco espacio en el servidor, una interrupción eléctrica, un fallo de comunicación o un problema
          en los componentes del sistema. Por favor, contacta a soporte para recibir asistencia.
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
