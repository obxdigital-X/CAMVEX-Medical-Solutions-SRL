"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { logLogin } from "@/app/admin/actions/activity"
import "./admin.css"

export function AdminLogin() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  // Show a notice when the previous session was closed by the 10-min idle timer
  // (the dashboard redirects here with ?timeout=1 in that case).
  const [idleClosed] = useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("timeout") === "1"
  })

  // Track Caps Lock so we can warn the user before they submit a wrong password.
  function checkCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState("CapsLock"))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { error } = await authClient.signIn.username({
        username: username.trim(),
        password,
      })
      if (error) {
        setError("Usuario o contraseña incorrectos.")
        setLoading(false)
        return
      }
      // Record the access in the Caché (best-effort; never blocks the redirect).
      try {
        await logLogin()
      } catch {}
      // Signal the dashboard to play the welcome animation once after this login.
      try {
        sessionStorage.setItem("admin-just-logged-in", "1")
      } catch {}
      router.push("/admin/dashboard")
      router.refresh()
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.")
      setLoading(false)
    }
  }

  return (
    <div className="admin-auth">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <div className="admin-auth-head">
          <img src="/assets/camvex-logo-transparent.png" alt="CAMVEX Medical Solutions" className="admin-auth-logo" />
          <h1>Panel de administración</h1>
          <p>Inicia sesión para gestionar el sitio.</p>
        </div>

        {idleClosed ? (
          <p className="admin-auth-notice" role="status">
            Tu sesión se cerró automáticamente por 10 minutos de inactividad. Vuelve a iniciar sesión.
          </p>
        ) : null}

        <label className="admin-field">
          <span>Usuario</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="username"
            required
          />
        </label>

        <label className="admin-field">
          <span>Contraseña</span>
          <div className="admin-password-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={checkCaps}
              onKeyDown={checkCaps}
              onBlur={() => setCapsOn(false)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="admin-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? (
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
          </div>
          {capsOn ? (
            <span className="admin-caps-warning" role="status">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 8 6-6 6 6" />
                <path d="M6 12h12" />
                <path d="M9 16h6" />
                <path d="M9 20h6" />
              </svg>
              Bloq Mayús está activado
            </span>
          ) : null}
        </label>

        {error ? <p className="admin-auth-error">{error}</p> : null}

        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
          {loading ? "Ingresando…" : "Iniciar sesión"}
        </button>

        <a href="/" className="admin-auth-back">
          ← Volver al sitio
        </a>
      </form>
    </div>
  )
}
