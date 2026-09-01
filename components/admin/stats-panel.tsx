"use client"

import useSWR from "swr"
import { getVisitStats, type VisitStats, type CountRow } from "@/app/admin/actions/stats"

// Minimal ISO country-code → Spanish name map for the countries most likely to
// appear. Anything not listed falls back to its code, so the panel never breaks.
const COUNTRY_NAMES: Record<string, string> = {
  DO: "República Dominicana",
  US: "Estados Unidos",
  ES: "España",
  MX: "México",
  CO: "Colombia",
  AR: "Argentina",
  PE: "Perú",
  CL: "Chile",
  VE: "Venezuela",
  EC: "Ecuador",
  GT: "Guatemala",
  CR: "Costa Rica",
  PA: "Panamá",
  PR: "Puerto Rico",
  CU: "Cuba",
  HT: "Haití",
  BR: "Brasil",
  CA: "Canadá",
  FR: "Francia",
  DE: "Alemania",
  IT: "Italia",
  GB: "Reino Unido",
  PT: "Portugal",
  CN: "China",
  IN: "India",
}

function countryLabel(code: string): string {
  if (!code || code === "Desconocido") return "Desconocido"
  return COUNTRY_NAMES[code] ?? code
}

// A brand-consistent color per known source; others cycle through accents.
const SOURCE_COLORS: Record<string, string> = {
  Instagram: "#c13584",
  Facebook: "#1877f2",
  WhatsApp: "#25d366",
  Google: "#ea4335",
  LinkedIn: "#0a66c2",
  YouTube: "#ff0000",
  TikTok: "#010101",
  Directo: "var(--navy)",
  "X (Twitter)": "#111111",
}
const FALLBACK_COLORS = ["#35c1e8", "#02265a", "#f59e0b", "#16a05c", "#8b5cf6", "#e11d48"]

function BarList({ rows, kind }: { rows: CountRow[]; kind: "country" | "source" }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="stats-barlist">
      {rows.map((r, i) => {
        const label = kind === "country" ? countryLabel(r.label) : r.label
        const color =
          kind === "source"
            ? SOURCE_COLORS[r.label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]
            : "var(--cyan)"
        return (
          <div key={r.label} className="stats-bar-row">
            <div className="stats-bar-label">
              {kind === "country" && r.label !== "Desconocido" && (
                <span className="stats-cc">{r.label}</span>
              )}
              <span className="stats-bar-name">{label}</span>
            </div>
            <div className="stats-bar-track" role="img" aria-label={`${label}: ${r.count}`}>
              <div
                className="stats-bar-fill"
                style={{ width: `${(r.count / max) * 100}%`, background: color }}
              />
            </div>
            <span className="stats-bar-count">{r.count}</span>
          </div>
        )
      })}
    </div>
  )
}

function DayChart({ perDay }: { perDay: VisitStats["perDay"] }) {
  const max = Math.max(1, ...perDay.map((d) => d.count))
  return (
    <div className="stats-chart" role="img" aria-label="Visitas de los últimos 14 días">
      {perDay.map((d) => {
        const date = new Date(`${d.day}T00:00:00`)
        const dd = String(date.getDate()).padStart(2, "0")
        const mm = String(date.getMonth() + 1).padStart(2, "0")
        return (
          <div key={d.day} className="stats-chart-col" title={`${dd}/${mm}: ${d.count} visitas`}>
            <div className="stats-chart-barwrap">
              <div className="stats-chart-bar" style={{ height: `${(d.count / max) * 100}%` }}>
                {d.count > 0 && <span className="stats-chart-val">{d.count}</span>}
              </div>
            </div>
            <span className="stats-chart-x">{dd}/{mm}</span>
          </div>
        )
      })}
    </div>
  )
}

export function StatsPanel({ initialStats }: { initialStats: VisitStats }) {
  const { data, isValidating, mutate } = useSWR<VisitStats>("admin-stats", () => getVisitStats(), {
    fallbackData: initialStats,
    refreshInterval: 30000,
    revalidateOnFocus: true,
  })
  const stats = data ?? initialStats

  const cards = [
    { label: "Visitas totales", value: stats.total },
    { label: "Hoy", value: stats.today },
    { label: "Últimos 7 días", value: stats.last7 },
    { label: "Últimos 30 días", value: stats.last30 },
    { label: "Países", value: stats.countriesCount },
    { label: "Canal principal", value: stats.topSource ?? "—", isText: true },
  ]

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Estadísticas</h2>
          <p>
            Visitas al sitio web: cuántas personas entran, desde qué país y por cuál vía llegaron
            (Instagram, Google, enlace directo…). Se actualiza automáticamente.
          </p>
        </div>
        <button className="admin-btn" onClick={() => mutate()} disabled={isValidating}>
          <span className={`cache-live-dot ${isValidating ? "is-syncing" : ""}`} aria-hidden="true" />
          {isValidating ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="stats-cards">
        {cards.map((c) => (
          <div key={c.label} className="stats-card">
            <span className="stats-card-label">{c.label}</span>
            <span className={`stats-card-value ${c.isText ? "is-text" : ""}`}>{c.value}</span>
          </div>
        ))}
      </div>

      {stats.total === 0 ? (
        <div className="admin-empty">
          Aún no hay visitas registradas. En cuanto alguien entre al sitio web, sus datos aparecerán aquí.
        </div>
      ) : (
        <>
          <div className="stats-section">
            <h3 className="stats-section-title">Visitas por día (últimos 14 días)</h3>
            <DayChart perDay={stats.perDay} />
          </div>

          <div className="stats-grid">
            <div className="stats-section">
              <h3 className="stats-section-title">Por país</h3>
              {stats.byCountry.length ? (
                <BarList rows={stats.byCountry} kind="country" />
              ) : (
                <p className="stats-muted">Sin datos de país todavía.</p>
              )}
            </div>
            <div className="stats-section">
              <h3 className="stats-section-title">Por vía de entrada</h3>
              <BarList rows={stats.bySource} kind="source" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
