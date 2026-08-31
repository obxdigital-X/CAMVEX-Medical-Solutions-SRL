"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { AdminUser, Permission } from "@/lib/admin-auth"
import {
  type ManagedUser,
  createUser,
  deleteUser,
  updateUserPermissions,
  setUserPassword,
  setUserMaintenance,
} from "@/app/admin/actions/users"

// Show/hide toggle used inside password fields, mirroring the login screen.
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

const PERMISSIONS: { key: Permission; label: string; hint: string }[] = [
  { key: "catalog", label: "Gestionar catálogo", hint: "Agregar, editar y quitar equipos del catálogo." },
  { key: "messages", label: "Ver mensajes/contactos", hint: "Leer las solicitudes del formulario de contacto." },
  { key: "sheets", label: "Gestionar fichas técnicas", hint: "Crear, editar y descargar fichas técnicas de productos." },
  { key: "quotes", label: "Gestionar cotizaciones", hint: "Crear, editar y descargar cotizaciones para clientes." },
]

export function UsersPanel({ me, initialUsers }: { me: AdminUser; initialUsers: ManagedUser[] }) {
  const router = useRouter()
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [note, setNote] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  // Which rows currently reveal their password (admin-only view).
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Change-password modal state
  const [pwUser, setPwUser] = useState<ManagedUser | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [showNewPw, setShowNewPw] = useState(false)

  // Create form state
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [perms, setPerms] = useState<Permission[]>([])
  const [saving, setSaving] = useState(false)
  const [showCreatePw, setShowCreatePw] = useState(false)

  function resetForm() {
    setName("")
    setUsername("")
    setPassword("")
    setPerms([])
    setShowCreatePw(false)
  }

  function togglePerm(list: Permission[], p: Permission): Permission[] {
    return list.includes(p) ? list.filter((x) => x !== p) : [...list, p]
  }

  async function refresh() {
    router.refresh()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNote(null)
    const res = await createUser({ name, username, password, permissions: perms })
    setSaving(false)
    if (!res.ok) {
      setNote({ type: "err", text: res.error ?? "No se pudo crear el usuario." })
      return
    }
    setNote({ type: "ok", text: `Usuario "${username.trim().toLowerCase()}" creado.` })
    setShowCreate(false)
    // Capture the typed password for the optimistic row before clearing the form.
    const createdPassword = password
    resetForm()
    // Optimistically add; refresh to get canonical data.
    setUsers((prev) => [
      {
        id: `temp-${Date.now()}`,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        role: "editor",
        permissions: perms,
        maintenance: false,
        createdAt: new Date().toISOString(),
        password: createdPassword,
      },
      ...prev,
    ])
    refresh()
  }

  async function handleTogglePerm(u: ManagedUser, p: Permission) {
    const next = togglePerm(u.permissions, p)
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, permissions: next } : x)))
    const res = await updateUserPermissions({ userId: u.id, permissions: next })
    if (!res.ok) {
      setNote({ type: "err", text: res.error ?? "No se pudo actualizar." })
      refresh()
    }
  }

  async function handleDelete(u: ManagedUser) {
    if (!confirm(`¿Eliminar al usuario "${u.username}"? Esta acción no se puede deshacer.`)) return
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
    const res = await deleteUser(u.id)
    if (!res.ok) {
      setNote({ type: "err", text: res.error ?? "No se pudo eliminar." })
      refresh()
    } else {
      setNote({ type: "ok", text: "Usuario eliminado." })
    }
  }

  async function handleToggleMaintenance(u: ManagedUser) {
    const next = !u.maintenance
    const verb = next ? "poner en mantenimiento (bloquear el acceso)" : "quitar del mantenimiento (restaurar el acceso)"
    if (!confirm(`¿Deseas ${verb} a "${u.username}"?`)) return
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, maintenance: next } : x)))
    const res = await setUserMaintenance({ userId: u.id, maintenance: next })
    if (!res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, maintenance: !next } : x)))
      setNote({ type: "err", text: res.error ?? "No se pudo actualizar el estado." })
      return
    }
    setNote({
      type: "ok",
      text: next
        ? `"${u.username}" fue puesto en mantenimiento. No podrá acceder al panel.`
        : `Se restauró el acceso de "${u.username}".`,
    })
    refresh()
  }

  function openPasswordModal(u: ManagedUser) {
    setPwUser(u)
    setNewPassword("")
    setPwError(null)
    setShowNewPw(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwUser) return
    setPwSaving(true)
    setPwError(null)
    const res = await setUserPassword({ userId: pwUser.id, password: newPassword })
    setPwSaving(false)
    if (!res.ok) {
      setPwError(res.error ?? "No se pudo actualizar la contraseña.")
      return
    }
    setNote({ type: "ok", text: `Contraseña actualizada para "${pwUser.username}".` })
    setPwUser(null)
    setNewPassword("")
  }

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Usuarios</h2>
          <p>Crea cuentas de acceso y asigna qué puede hacer cada persona.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowCreate(true)}>
          + Nuevo usuario
        </button>
      </div>

      {note && <div className={`admin-note ${note.type}`}>{note.text}</div>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Contraseña</th>
            <th>Rol</th>
            <th>Permisos</th>
            <th style={{ textAlign: "right" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isAdminRow = u.role === "admin"
            return (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>
                  <code>{u.username}</code>
                </td>
                <td>
                  {u.password ? (
                    <div className="admin-pw-cell">
                      <code>{revealed.has(u.id) ? u.password : "••••••••"}</code>
                      <EyeToggle shown={revealed.has(u.id)} onToggle={() => toggleReveal(u.id)} />
                    </div>
                  ) : (
                    <span
                      style={{ color: "var(--slate)", fontSize: 12 }}
                      title="Se mostrará cuando esta persona cambie su contraseña o cuando la restablezcas."
                    >
                      No disponible
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <span className={`admin-chip ${isAdminRow ? "role-admin" : ""}`}>
                      {isAdminRow ? "Administrador" : "Editor"}
                    </span>
                    {u.maintenance && <span className="admin-chip chip-maint">En mantenimiento</span>}
                  </div>
                </td>
                <td>
                  {isAdminRow ? (
                    <span style={{ color: "var(--slate)", fontSize: 13 }}>Todos los permisos</span>
                  ) : (
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {PERMISSIONS.map((p) => (
                        <label
                          key={p.key}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={u.permissions.includes(p.key)}
                            onChange={() => handleTogglePerm(u, p.key)}
                            style={{ accentColor: "var(--cyan)" }}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button
                      className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => openPasswordModal(u)}
                    >
                      Contraseña
                    </button>
                    {!isAdminRow && (
                      <button
                        className={`admin-btn admin-btn-sm ${u.maintenance ? "admin-btn-primary" : "admin-btn-warn"}`}
                        onClick={() => handleToggleMaintenance(u)}
                      >
                        {u.maintenance ? "Restaurar acceso" : "Mantenimiento"}
                      </button>
                    )}
                    {!isAdminRow && (
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(u)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {showCreate && (
        <div className="admin-modal-overlay" onClick={() => setShowCreate(false)}>
          <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Nuevo usuario</h3>

            <label className="admin-field">
              <span>Nombre completo</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: María Pérez" required />
            </label>

            <label className="admin-field">
              <span>Nombre de usuario</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: mperez"
                autoCapitalize="none"
                required
              />
            </label>

            <label className="admin-field">
              <span>Contraseña (mínimo 8 caracteres)</span>
              <div className="admin-password-wrap">
                <input
                  type={showCreatePw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña temporal"
                  autoComplete="new-password"
                  required
                />
                <EyeToggle shown={showCreatePw} onToggle={() => setShowCreatePw((v) => !v)} />
              </div>
            </label>

            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>Permisos</span>
              <div className="admin-perms" style={{ marginTop: 8 }}>
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="admin-perm">
                    <input
                      type="checkbox"
                      checked={perms.includes(p.key)}
                      onChange={() => setPerms((prev) => togglePerm(prev, p.key))}
                    />
                    <span>
                      {p.label}
                      <small>{p.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pwUser && (
        <div className="admin-modal-overlay" onClick={() => setPwUser(null)}>
          <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleChangePassword}>
            <h3>Cambiar contraseña</h3>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--slate)" }}>
              Estableciendo una nueva contraseña para <code>{pwUser.username}</code>
              {pwUser.role === "admin" ? " (administrador)" : ""}.
            </p>

            {pwError && <div className="admin-note err">{pwError}</div>}

            <label className="admin-field">
              <span>Nueva contraseña (mínimo 8 caracteres)</span>
              <div className="admin-password-wrap">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  autoComplete="new-password"
                  required
                />
                <EyeToggle shown={showNewPw} onToggle={() => setShowNewPw((v) => !v)} />
              </div>
            </label>

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setPwUser(null)}>
                Cancelar
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={pwSaving}>
                {pwSaving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
