"use client"

import { useEffect, useState } from "react"

/**
 * Full-screen welcome animation shown once right after a successful login.
 * It reads a one-shot flag from sessionStorage (set by the login form) so it
 * only plays on a real sign-in, not on every dashboard reload or navigation.
 */
export function AdminWelcome({ name }: { name: string }) {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let justLoggedIn = false
    try {
      justLoggedIn = sessionStorage.getItem("admin-just-logged-in") === "1"
    } catch {}

    if (!justLoggedIn) return

    setShow(true)
    // Start fade-out, then unmount. The one-shot flag is cleared only when the
    // animation finishes so React 18 Strict Mode's double-invoke (which clears
    // the timers on its first cleanup) can still re-arm them on re-run.
    const leaveTimer = setTimeout(() => setLeaving(true), 2200)
    const hideTimer = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.removeItem("admin-just-logged-in")
      } catch {}
    }, 2800)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  // Keep only the first name for a friendlier greeting.
  const firstName = (name || "").trim().split(/\s+/)[0] || name

  return (
    <div className={`admin-welcome ${leaving ? "leaving" : ""}`} role="status" aria-live="polite">
      <div className="admin-welcome-card">
        <span className="admin-welcome-logo" role="img" aria-label="CAMVEX Medical Solutions" />
        <p className="admin-welcome-kicker">Panel de administración</p>
        <h2 className="admin-welcome-title">
          Bienvenid@ <span>{firstName}</span>
        </h2>
        <div className="admin-welcome-bar" aria-hidden="true" />
      </div>
    </div>
  )
}
