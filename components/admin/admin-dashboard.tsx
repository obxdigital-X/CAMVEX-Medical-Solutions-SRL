"use client"

import { useState } from "react"
import { endAdminSession } from "@/app/admin/actions/activity"
import type { AdminUser } from "@/lib/admin-auth"
import type { ManagedUser } from "@/app/admin/actions/users"
import type { EquipmentItem } from "@/app/admin/actions/equipment"
import type { Message } from "@/app/admin/actions/messages"
import type { ContentMap } from "@/app/admin/actions/content"
import type { DataSheet } from "@/app/admin/actions/data-sheets"
import type { Quotation } from "@/app/admin/actions/quotations"
import type { ActivityEntry } from "@/app/admin/actions/activity"
import type { Partner } from "@/app/admin/actions/partners"
import { AdminWelcome } from "./admin-welcome"
import { UsersPanel } from "./users-panel"
import { CatalogPanel } from "./catalog-panel"
import { MessagesPanel } from "./messages-panel"
import { ContentPanel } from "./content-panel"
import { DataSheetsPanel } from "./data-sheets-panel"
import { QuotationsPanel } from "./quotations-panel"
import { ActivityPanel } from "./activity-panel"
import { PartnersPanel } from "./partners-panel"
import { SupportButton } from "./support-button"
import { ChangeMyPassword } from "./change-my-password"
import "./admin.css"

type Tab = "users" | "catalog" | "messages" | "content" | "sheets" | "quotes" | "cache" | "partners"

export function AdminDashboard({
  me,
  initialUsers,
  initialEquipment,
  initialMessages,
  initialUnread,
  initialContent,
  initialSheets,
  initialQuotations,
  initialActivity,
  initialPartners,
}: {
  me: AdminUser
  initialUsers: ManagedUser[]
  initialEquipment: EquipmentItem[]
  initialMessages: Message[]
  initialUnread: number
  initialContent: ContentMap
  initialSheets: DataSheet[]
  initialQuotations: Quotation[]
  initialActivity: ActivityEntry[]
  initialPartners: Partner[]
}) {
  const canCatalog = me.isAdmin || me.permissions.includes("catalog")
  const canMessages = me.isAdmin || me.permissions.includes("messages")
  const canSheets = me.isAdmin || me.permissions.includes("sheets")
  const canQuotes = me.isAdmin || me.permissions.includes("quotes")

  // First available tab for this user.
  const firstTab: Tab = me.isAdmin
    ? "users"
    : canCatalog
      ? "catalog"
      : canMessages
        ? "messages"
        : canSheets
          ? "sheets"
          : canQuotes
            ? "quotes"
            : "users"
  const [tab, setTab] = useState<Tab>(firstTab)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    // Sign out on the SERVER: this logs the exit and clears the session cookie
    // reliably (the client-side signOut fetch can fail to delete the cross-site
    // cookie inside the v0 preview iframe, which left the user still logged in).
    try {
      await endAdminSession()
    } catch (err) {
      console.error("[v0] endAdminSession error:", err)
    }
    // Hard navigation guarantees a fresh request with the cleared cookie, so
    // /admin renders the login screen instead of bouncing back to the dashboard.
    window.location.href = "/admin"
  }

  return (
    <div className="admin-root">
      <AdminWelcome name={me.name} />
      <div className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-logo" role="img" aria-label="CAMVEX Medical Solutions" />
          <span>Panel de administración</span>
        </div>
        <div className="admin-topbar-user">
          <b>{me.name}</b>
          <span className="admin-role">{me.isAdmin ? "Administrador" : "Editor"}</span>
          <ChangeMyPassword />
          <button className="admin-logout" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
      </div>

      <div className="admin-body">
        <nav className="admin-nav">
          {me.isAdmin && (
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              Usuarios
            </button>
          )}
          {canCatalog && (
            <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>
              Catálogo
            </button>
          )}
          {canMessages && (
            <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>
              Mensajes
              {initialUnread > 0 && <span className="admin-nav-badge">{initialUnread}</span>}
            </button>
          )}
          {canSheets && (
            <button className={tab === "sheets" ? "active" : ""} onClick={() => setTab("sheets")}>
              Fichas técnicas
            </button>
          )}
          {canQuotes && (
            <button className={tab === "quotes" ? "active" : ""} onClick={() => setTab("quotes")}>
              Cotizaciones
            </button>
          )}
          {me.isAdmin && (
            <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>
              Textos del sitio
            </button>
          )}
          {me.isAdmin && (
            <button className={tab === "partners" ? "active" : ""} onClick={() => setTab("partners")}>
              Aliados
            </button>
          )}
          {me.isAdmin && (
            <button className={tab === "cache" ? "active" : ""} onClick={() => setTab("cache")}>
              Caché
            </button>
          )}
          <div className="admin-nav-foot" style={{ marginTop: "auto" }}>
            <SupportButton defaultName={me.name} />
            <a href="/" className="admin-nav-site">
              <button style={{ width: "100%" }}>← Ver el sitio</button>
            </a>
          </div>
        </nav>

        <main className="admin-main">
          {tab === "users" && me.isAdmin && <UsersPanel me={me} initialUsers={initialUsers} />}
          {tab === "catalog" && canCatalog && <CatalogPanel initialEquipment={initialEquipment} />}
          {tab === "messages" && canMessages && <MessagesPanel initialMessages={initialMessages} />}
          {tab === "sheets" && canSheets && <DataSheetsPanel initialSheets={initialSheets} />}
          {tab === "quotes" && canQuotes && <QuotationsPanel initialQuotations={initialQuotations} />}
          {tab === "content" && me.isAdmin && <ContentPanel initialContent={initialContent} />}
          {tab === "partners" && me.isAdmin && <PartnersPanel initialPartners={initialPartners} />}
          {tab === "cache" && me.isAdmin && <ActivityPanel initialActivity={initialActivity} />}
        </main>
      </div>
    </div>
  )
}
