"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { saveMessage } from "@/app/admin/actions/messages"
import { LanguageSelector } from "@/components/language-selector"
import { makeT, isLang, contentDefault, type Lang, DEFAULT_LANG } from "@/lib/i18n"
import { COUNTRIES, flagUrl } from "@/lib/countries"

const WA = "https://wa.me/18298622291"

// Fallback institutions shown in the strategic-alliances ticker when the admin
// hasn't configured any yet (the DB is normally seeded with these).
const DEFAULT_PARTNERS: { name: string; src: string }[] = [
  { name: "Clínica Independencia", src: "/partners/clinica-independencia.png" },
  { name: "AMEDOSA · Clínica San Cristóbal", src: "/partners/amedosa.png" },
  { name: "GRUMED · Grupo Médico San Cristóbal", src: "/partners/grumed.png" },
]

export type PublicEquipment = {
  id: number
  name: string
  category: string
  description: string
  image: string
  tag: string
  specs: string[]
}

// Renders text with *asterisk* segments wrapped in <em> for the accent style.
function renderEmphasis(text: string): React.ReactNode {
  const parts = text.split("*")
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : <span key={i}>{part}</span>))
}

export function CamvexSite({
  equipmentByLang = {},
  content = {},
  partners,
}: {
  equipmentByLang?: Partial<Record<Lang, PublicEquipment[]>>
  content?: Partial<Record<Lang, Record<string, string>>>
  partners?: { name: string; src: string }[]
}) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG)
  const t = makeT(lang)

  // Admin-managed alliance logos, falling back to the built-in list.
  const partnerList = partners && partners.length > 0 ? partners : DEFAULT_PARTNERS

  // Catalog for the active language, falling back to Spanish, then any available list.
  const equipment: PublicEquipment[] =
    equipmentByLang[lang] ?? equipmentByLang[DEFAULT_LANG] ?? []

  // Reads an editable text for the active language. Priority:
  // 1) admin's explicit per-language override saved in the DB
  // 2) built-in dictionary translation for this language (so everything
  //    translates out of the box even without an admin override)
  // 3) admin's base (Spanish) value — for fields with no dictionary default
  //    such as phone numbers and emails
  // 4) hardcoded fallback
  const c = (key: string, fallback: string) => {
    const perLang = content[lang]?.[key]
    if (perLang != null && perLang !== "") return perLang
    const def = contentDefault(lang, key)
    if (def != null) return def
    const es = content[DEFAULT_LANG]?.[key]
    if (es != null && es !== "") return es
    return fallback
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [year, setYear] = useState<number>(2026)

  // Catalog filtering + pagination.
  const CATALOG_PAGE_SIZE = 9
  const [catFilter, setCatFilter] = useState<string>("all")
  const [catPage, setCatPage] = useState(1)

  // Contact form phone: selected country + local digits + validation error.
  const [countryIso, setCountryIso] = useState("DO")
  const [phoneLocal, setPhoneLocal] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [countryOpen, setCountryOpen] = useState(false)
  const [countryQuery, setCountryQuery] = useState("")
  const countryBoxRef = useRef<HTMLDivElement>(null)
  const selectedCountry = COUNTRIES.find((co) => co.iso === countryIso) ?? COUNTRIES[0]
  // Strip diacritics so "japon" matches "Japón", "peru" matches "Perú", etc.
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const filteredCountries = COUNTRIES.filter((co) => {
    const q = normalize(countryQuery.trim())
    if (!q) return true
    const digits = q.replace(/\D/g, "")
    return normalize(co.name).includes(q) || co.iso.toLowerCase().includes(q) || (digits.length > 0 && co.dial.includes(digits))
  })
  const expectedDigits = selectedCountry.min === selectedCountry.max ? `${selectedCountry.min}` : `${selectedCountry.min}–${selectedCountry.max}`

  // Close the country dropdown when clicking outside of it.
  useEffect(() => {
    if (!countryOpen) return
    const onDown = (e: MouseEvent) => {
      if (countryBoxRef.current && !countryBoxRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
        setCountryQuery("")
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [countryOpen])

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  // Restore the saved language on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("camvex_lang")
      if (isLang(saved)) setLang(saved)
    } catch {
      /* ignore */
    }
  }, [])

  function changeLang(l: Lang) {
    setLang(l)
    try {
      localStorage.setItem("camvex_lang", l)
      document.cookie = `camvex_lang=${l};path=/;max-age=31536000;samesite=lax`
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = l
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const revealEls = root.querySelectorAll(".reveal")
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in")
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    revealEls.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = (form.elements.namedItem("fname") as HTMLInputElement).value.trim()
    const inst = (form.elements.namedItem("finst") as HTMLInputElement).value.trim()
    // Validate the phone digit count against the selected country before sending.
    const digits = phoneLocal.replace(/\D/g, "")
    if (digits.length < selectedCountry.min || digits.length > selectedCountry.max) {
      setPhoneError(t("form_phone_invalid"))
      ;(form.elements.namedItem("fphone") as HTMLInputElement)?.focus()
      return
    }
    setPhoneError(null)
    const phone = `+${selectedCountry.dial} ${digits}`
    const interestEl = form.elements.namedItem("finterest") as HTMLSelectElement
    const interest = interestEl.options[interestEl.selectedIndex]?.text ?? interestEl.value
    const msg = (form.elements.namedItem("fmsg") as HTMLTextAreaElement).value.trim()
    // Persist the submission for the admin panel (fire-and-forget, never blocks WhatsApp).
    void saveMessage({ name, institution: inst, interest, message: msg, phone }).catch(() => {})
    let text = `${t("wa_greeting")} ${name}`
    if (inst) text += ` ${t("wa_from")} ${inst}`
    text += `. ${t("wa_interest")} ${interest}. ${msg}`
    window.open(`${WA}?text=${encodeURIComponent(text)}`, "_blank")
  }

  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )

  // Unique categories in first-seen order (ignoring blanks), used for the filter.
  const categories = Array.from(
    new Set(equipment.map((e) => e.category?.trim()).filter((v): v is string => !!v)),
  )

  // Apply the active category filter, then paginate 9 items per page.
  const filteredEquipment =
    catFilter === "all" ? equipment : equipment.filter((e) => e.category?.trim() === catFilter)
  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / CATALOG_PAGE_SIZE))
  const currentPage = Math.min(catPage, totalPages)
  const pageEquipment = filteredEquipment.slice(
    (currentPage - 1) * CATALOG_PAGE_SIZE,
    currentPage * CATALOG_PAGE_SIZE,
  )

  // Reset to the first page whenever the filter or language changes.
  useEffect(() => {
    setCatPage(1)
  }, [catFilter, lang])

  function goToPage(p: number) {
    setCatPage(p)
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="camvex" ref={rootRef}>
      {/* ================= HEADER ================= */}
      <header>
        <nav className="nav">
          <a href="#inicio" className="brand" aria-label="CAMVEX Medical Solutions">
            <img src="/assets/camvex-logo-transparent.png" alt="CAMVEX Medical Solutions" className="brand-logo" />
          </a>
          <div className="navlinks">
            <a href="#nosotros">{t("nav_about")}</a>
            <a href="#servicios">{t("nav_services")}</a>
            <a href="#catalogo">{t("nav_catalog")}</a>
            <a href="#proceso">{t("nav_process")}</a>
            <a href="#contacto">{t("nav_contact")}</a>
          </div>
          <div className="nav-right">
            <a href={WA} target="_blank" rel="noreferrer" className="nav-cta">
              {t("nav_sales")}
            </a>
            <LanguageSelector lang={lang} onChange={changeLang} label={t("language_label")} />
            <a href="/admin" className="nav-admin" aria-label={t("nav_admin")} title={t("nav_admin")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("nav_admin")}</span>
            </a>
          </div>
          <button className="burger" aria-label={t("nav_sales")} onClick={() => setMenuOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        </nav>
      </header>

      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <button className="mobile-close" aria-label={t("nav_contact")} onClick={() => setMenuOpen(false)}>
          ×
        </button>
        {[
          { id: "nosotros", key: "nav_about" },
          { id: "servicios", key: "nav_services" },
          { id: "catalogo", key: "nav_catalog" },
          { id: "proceso", key: "nav_process" },
          { id: "contacto", key: "nav_contact" },
        ].map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)}>
            {t(item.key)}
          </a>
        ))}
      </div>

      {/* ================= HERO ================= */}
      <section className="hero" id="inicio">
        <div className="wrap">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="dot-live" /> {c("hero_eyebrow", "Santo Domingo · República Dominicana")}
            </div>
            <h1>
              {renderEmphasis(
                c("hero_title", "Equipos médicos y de laboratorio, con *respuesta real* cuando los necesitas."),
              )}
            </h1>
            <p className="lead">
              {c(
                "hero_lead",
                "Comercializamos y distribuimos equipos, dispositivos, insumos y servicio de esterilización para clínicas, laboratorios de patología y centros médicos. No mostramos un catálogo interminable: identificamos la necesidad y encontramos la alternativa correcta.",
              )}
            </p>
            <div className="hero-actions">
              <a href={WA} target="_blank" rel="noreferrer" className="btn btn-primary">
                {t("hero_cta_wa")}
                {arrow}
              </a>
              <a href="#catalogo" className="btn btn-ghost">
                {t("hero_cta_catalog")}
              </a>
            </div>
            <div className="hero-pillars">
              <div>
                <span className="pillar-dot" style={{ background: "#0EA37D" }} /> {t("pillar_tech")}
              </div>
              <div>
                <span className="pillar-dot" style={{ background: "var(--navy)" }} /> {t("pillar_innovation")}
              </div>
              <div>
                <span className="pillar-dot" style={{ background: "#D8A83B" }} /> {t("pillar_trust")}
              </div>
              <div>
                <span className="pillar-dot" style={{ background: "var(--red)" }} /> {t("pillar_results")}
              </div>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-glow" />
            <div className="frame">
              <img src="/assets/hero-doctor.png" alt="Profesional médico representando soluciones CAMVEX" />
            </div>
            <div className="float-card float-1">
              <div>
                <b>+{equipment.length}</b>
                {t("hero_float1")}
              </div>
            </div>
            <div className="float-card float-2">
              <div>
                <b>{t("hero_float2_a")}</b>
                {t("hero_float2_b")}
              </div>
            </div>
          </div>
        </div>
        <div className="pulse-rule" aria-hidden="true">
          <svg viewBox="0 0 600 34" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <polyline
              points="0,17 60,17 75,17 85,2 95,32 105,17 120,17 180,17 195,17 205,2 215,32 225,17 240,17 300,17 315,17 325,2 335,32 345,17 360,17 420,17 435,17 445,2 455,32 465,17 480,17 540,17 555,17 565,2 575,32 585,17 600,17"
              fill="none"
              stroke="#C8232D"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </svg>
        </div>
      </section>

      {/* ================= NOSOTROS ================= */}
      <section className="nosotros" id="nosotros">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("about_eyebrow")}</div>
            <h2>{c("about_heading", "Un socio estratégico para el sector salud, no solo un proveedor.")}</h2>
            <p>
              {c(
                "about_text",
                "CAMVEX Medical Solutions es una empresa dominicana enfocada en la comercialización y distribución de equipos médicos, dispositivos, materiales desechables e insumos especializados para instituciones y profesionales de la salud.",
              )}
            </p>
          </div>

          <div className="nosotros-grid">
            <div className="mv-card mission reveal">
              <h3>{t("mission_title")}</h3>
              <p>
                {c(
                  "mission_text",
                  "Distribuir equipos, dispositivos y suministros médicos confiables a clínicas, laboratorios y centros de salud en República Dominicana, garantizando disponibilidad, respaldo técnico y continuidad en cada suministro.",
                )}
              </p>
              <span className="tag">{t("mission_tag")}</span>
            </div>
            <div className="mv-card vision reveal">
              <h3>{t("vision_title")}</h3>
              <p>
                {c(
                  "vision_text",
                  "Ser una empresa reconocida en República Dominicana por representar una nueva generación en la distribución de soluciones médicas, incorporando innovación, tecnología y productos de vanguardia al mercado nacional.",
                )}
              </p>
              <span className="tag">{t("vision_tag")}</span>
            </div>
          </div>

          <div className="pillars-row reveal">
            <div className="pillar">
              <span className="swatch" style={{ background: "#0EA37D" }} />
              <span>{t("pillar_tech")}</span>
            </div>
            <div className="pillar">
              <span className="swatch" style={{ background: "var(--navy)" }} />
              <span>{t("pillar_innovation")}</span>
            </div>
            <div className="pillar">
              <span className="swatch" style={{ background: "#D8A83B" }} />
              <span>{t("pillar_trust")}</span>
            </div>
            <div className="pillar">
              <span className="swatch" style={{ background: "var(--red)" }} />
              <span>{t("pillar_results")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SERVICIOS ================= */}
      <section className="servicios" id="servicios">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("services_eyebrow")}</div>
            <h2>{t("services_title")}</h2>
            <p>{t("services_desc")}</p>
          </div>

          <div className="services-grid">
            {[
              {
                code: "MD",
                title: t("svc_equipos_t"),
                desc: t("svc_equipos_d"),
                icon: (
                  <>
                    <rect x="3" y="7" width="18" height="12" rx="2" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M12 11v4M10 13h4" />
                  </>
                ),
              },
              {
                code: "DV",
                title: t("svc_dispositivos_t"),
                desc: t("svc_dispositivos_d"),
                icon: (
                  <>
                    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ),
              },
              {
                code: "IN",
                title: t("svc_insumos_t"),
                desc: t("svc_insumos_d"),
                icon: (
                  <>
                    <path d="M9 2h6l1 4H8l1-4Z" />
                    <path d="M7 6h10l1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L7 6Z" />
                  </>
                ),
              },
              {
                code: "LB",
                title: t("svc_laboratorio_t"),
                desc: t("svc_laboratorio_d"),
                icon: <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3" />,
              },
              {
                code: "ST",
                title: t("svc_esterilizacion_t"),
                desc: t("svc_esterilizacion_d"),
                icon: (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" />
                  </>
                ),
              },
              {
                code: "AB",
                title: t("svc_procurement_t"),
                desc: t("svc_procurement_d"),
                icon: (
                  <>
                    <path d="M21 21l-4.35-4.35" />
                    <circle cx="11" cy="11" r="7" />
                    <path d="M11 8v6M8 11h6" />
                  </>
                ),
              },
            ].map((s) => (
              <div className="service-card reveal" key={s.code}>
                <span className="code">{s.code}</span>
                <div className="icon-box">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {s.icon}
                  </svg>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CATALOGO ================= */}
      <section className="catalogo" id="catalogo">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("catalog_eyebrow")}</div>
            <h2>{t("catalog_title")}</h2>
            <p>{t("catalog_desc")}</p>
          </div>

          {categories.length > 0 && (
            <div className="cat-filters" role="group" aria-label={t("nav_catalog")}>
              <button
                type="button"
                className={`cat-filter${catFilter === "all" ? " is-active" : ""}`}
                onClick={() => setCatFilter("all")}
              >
                {t("catalog_filter_all")}
              </button>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`cat-filter${catFilter === cat ? " is-active" : ""}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="cat-grid">
            {pageEquipment.map((c) => (
              <div className="cat-card" key={c.id}>
                <div className="cat-media">
                  {c.tag ? <span className="model-tag">{c.tag}</span> : null}
                  <img src={c.image || "/placeholder.svg"} alt={c.name} />
                </div>
                <div className="cat-body">
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <div className="cat-specs">
                    {c.specs.map((sp) => (
                      <span key={sp}>{sp}</span>
                    ))}
                  </div>
                  <a
                    href={`${WA}?text=${encodeURIComponent(
                      `${t("catalog_wa_item")} ${c.name}${c.tag ? ` (${c.tag})` : ""}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cat-link"
                  >
                    {t("catalog_consult")}
                    {arrow}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="cat-pagination">
              <button
                type="button"
                className="cat-page-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                {t("catalog_prev")}
              </button>
              <div className="cat-page-dots">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`cat-page-num${p === currentPage ? " is-active" : ""}`}
                    onClick={() => goToPage(p)}
                    aria-current={p === currentPage ? "page" : undefined}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="cat-page-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                {t("catalog_next")}
              </button>
            </div>
          )}

          <div className="cat-more reveal">
            <a
              href={`${WA}?text=${encodeURIComponent(t("catalog_wa_full"))}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              {t("catalog_request_full")}
            </a>
          </div>
        </div>
      </section>

      {/* ================= PROCESO ================= */}
      <section className="proceso" id="proceso">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("process_eyebrow")}</div>
            <h2>{t("process_title")}</h2>
            <p>{t("process_desc")}</p>
          </div>

          <div className="timeline">
            {[
              { n: "01", t: t("step1_t"), p: t("step1_d") },
              { n: "02", t: t("step2_t"), p: t("step2_d") },
              { n: "03", t: t("step3_t"), p: t("step3_d") },
              { n: "04", t: t("step4_t"), p: t("step4_d") },
              { n: "05", t: t("step5_t"), p: t("step5_d") },
            ].map((step) => (
              <div className="t-step reveal" key={step.n}>
                <div className="t-num">{step.n}</div>
                <h4>{step.t}</h4>
                <p>{step.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= POR QUE ELEGIRNOS ================= */}
      <section className="porque">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("why_eyebrow")}</div>
            <h2>{t("why_title")}</h2>
            <p>{t("why_desc")}</p>
          </div>

          <div className="porque-grid reveal">
            {[
              { n: "01", t: t("why1_t"), p: t("why1_d") },
              { n: "02", t: t("why2_t"), p: t("why2_d") },
              { n: "03", t: t("why3_t"), p: t("why3_d") },
              { n: "04", t: t("why4_t"), p: t("why4_d") },
              { n: "05", t: t("why5_t"), p: t("why5_d") },
              { n: "06", t: t("why6_t"), p: t("why6_d") },
            ].map((item) => (
              <div className="porque-item" key={item.n}>
                <span className="pnum">{item.n}</span>
                <h4>{item.t}</h4>
                <p>{item.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ALIANZAS (TICKER) ================= */}
      <section className="partners" aria-label={t("partners_eyebrow")}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("partners_eyebrow")}</div>
            <h2>{t("partners_title")}</h2>
          </div>
        </div>
        <div className="partners-ticker reveal">
          <div className="partners-track">
            {/* One base set repeated to fill the viewport, then the whole thing
                is duplicated so translateX(-50%) loops seamlessly. */}
            {(() => {
              const base = [...partnerList, ...partnerList, ...partnerList]
              return [...base, ...base].map((p, i) => (
                <div className="partner-logo" key={`${p.name}-${i}`} aria-hidden={i >= base.length}>
                  <img src={p.src || "/placeholder.svg"} alt={i < base.length ? p.name : ""} loading="lazy" />
                </div>
              ))
            })()}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIAL ================= */}
      <section className="testimonial">
        <div className="wrap reveal">
          <h2>{t("testimonial_quote")}</h2>
          <div className="who">
            <div className="who-avatar">JC</div>
            <div className="who-text">
              <b>Jonatan Camacho</b>
              <span>{t("testimonial_role")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CONTACTO ================= */}
      <section className="contacto" id="contacto">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t("contact_eyebrow")}</div>
            <h2>{t("contact_title")}</h2>
            <p>{t("contact_desc")}</p>
          </div>

          <div className="contact-grid">
            <div className="contact-info reveal">
              <h3>{t("contact_channels")}</h3>
              <p>{c("contact_intro", "Escríbenos por el canal que prefieras, respondemos en 24 a 48 horas hábiles.")}</p>

              <div className="contact-list">
                <a href={WA} target="_blank" rel="noreferrer">
                  <span className="c-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <div>
                    <b>{c("contact_whatsapp", "829-862-2291")}</b>
                    <span>{t("contact_wa_label")}</span>
                  </div>
                </a>
                <a href={`tel:+1${c("contact_phone", "849-869-2292").replace(/[^0-9]/g, "")}`}>
                  <span className="c-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <div>
                    <b>{c("contact_phone", "849-869-2292")}</b>
                    <span>{t("contact_phone_label")}</span>
                  </div>
                </a>
                <a href={`mailto:${c("contact_email", "ventas@camvexrd.com")}`}>
                  <span className="c-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M22 6l-10 7L2 6" />
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                    </svg>
                  </span>
                  <div>
                    <b>{c("contact_email", "ventas@camvexrd.com")}</b>
                    <span>{t("contact_email_label")}</span>
                  </div>
                </a>
                <div>
                  <span className="c-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div>
                    <b>Santo Domingo</b>
                    <span>{t("contact_location_country")}</span>
                  </div>
                </div>
              </div>

              <div className="social-row">
                <a
                  href="https://instagram.com/camvexmedicalsolutions"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" />
                  </svg>
                </a>
                <a href={WA} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </a>
                <a href="mailto:ventas.camvex@gmail.com" aria-label="Correo">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2}>
                    <path d="M22 6l-10 7L2 6" />
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                  </svg>
                </a>
              </div>
            </div>

            <form className="contact-form reveal" onSubmit={handleSubmit}>
              <h3>{t("form_title")}</h3>
              <p>{t("form_subtitle")}</p>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="fname">{t("form_name")}</label>
                  <input type="text" id="fname" name="fname" required placeholder={t("form_name_ph")} />
                </div>
                <div className="form-field">
                  <label htmlFor="finst">{t("form_inst")}</label>
                  <input type="text" id="finst" name="finst" placeholder={t("form_inst_ph")} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field full">
                  <label htmlFor="fphone">{t("form_phone")}</label>
                  <div className={`phone-group${phoneError ? " invalid" : ""}`}>
                    <div className="phone-country" ref={countryBoxRef}>
                      <button
                        type="button"
                        className="phone-country-btn"
                        aria-haspopup="listbox"
                        aria-expanded={countryOpen}
                        aria-label={`${selectedCountry.name} (+${selectedCountry.dial})`}
                        onClick={() => {
                          setCountryOpen((o) => !o)
                          setCountryQuery("")
                        }}
                      >
                        <img
                          className="phone-flag"
                          src={flagUrl(selectedCountry.iso) || "/placeholder.svg"}
                          alt=""
                          aria-hidden="true"
                          width={24}
                          height={18}
                        />
                        <span className="phone-caret" aria-hidden="true">
                          ▾
                        </span>
                      </button>
                      {countryOpen && (
                        <div className="phone-dropdown" role="listbox">
                          <input
                            type="text"
                            className="phone-search"
                            autoFocus
                            placeholder={t("form_country_search")}
                            value={countryQuery}
                            onChange={(e) => setCountryQuery(e.target.value)}
                          />
                          <ul className="phone-options">
                            {filteredCountries.map((co) => (
                              <li key={co.iso}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={co.iso === countryIso}
                                  className={`phone-option${co.iso === countryIso ? " active" : ""}`}
                                  onClick={() => {
                                    setCountryIso(co.iso)
                                    setCountryOpen(false)
                                    setCountryQuery("")
                                    setPhoneError(null)
                                  }}
                                >
                                  <img
                                    className="phone-flag"
                                    src={flagUrl(co.iso) || "/placeholder.svg"}
                                    alt=""
                                    aria-hidden="true"
                                    width={24}
                                    height={18}
                                    loading="lazy"
                                  />
                                  <span className="phone-option-name">{co.name}</span>
                                  <span className="phone-option-dial">+{co.dial}</span>
                                </button>
                              </li>
                            ))}
                            {filteredCountries.length === 0 && (
                              <li className="phone-empty">{t("form_country_none")}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="phone-input">
                      <span className="phone-prefix">+{selectedCountry.dial}</span>
                      <input
                        type="tel"
                        id="fphone"
                        name="fphone"
                        required
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={selectedCountry.max}
                        placeholder={"0".repeat(selectedCountry.min)}
                        value={phoneLocal}
                        aria-invalid={phoneError ? true : undefined}
                        aria-describedby="fphone-help"
                        onChange={(e) => {
                          setPhoneLocal(e.target.value.replace(/\D/g, ""))
                          setPhoneError(null)
                        }}
                      />
                    </div>
                  </div>
                  <p id="fphone-help" className={`phone-help${phoneError ? " err" : ""}`}>
                    {phoneError ?? `${expectedDigits} ${t("form_phone_digits_label")}`}
                  </p>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field full">
                  <label htmlFor="finterest">{t("form_interest")}</label>
                  <select id="finterest" name="finterest" defaultValue="equipos">
                    <option value="equipos">{t("opt_equipos")}</option>
                    <option value="dispositivos">{t("opt_dispositivos")}</option>
                    <option value="insumos">{t("opt_insumos")}</option>
                    <option value="laboratorio">{t("opt_laboratorio")}</option>
                    <option value="esterilizacion">{t("opt_esterilizacion")}</option>
                    <option value="otro">{t("opt_otro")}</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field full">
                  <label htmlFor="fmsg">{t("form_message")}</label>
                  <textarea id="fmsg" name="fmsg" placeholder={t("form_message_ph")} required />
                </div>
              </div>
              <button type="submit" className="form-submit">
                {t("form_submit")}
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <p className="form-note">
                {t("form_note1")}
                <br />
                {t("form_note2")}
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <span className="foot-logo" role="img" aria-label="CAMVEX Medical Solutions" />
              <p>{t("footer_brand_desc")}</p>
            </div>
            <div>
              <h5>{t("footer_nav")}</h5>
              <ul>
                <li>
                  <a href="#nosotros">{t("nav_about")}</a>
                </li>
                <li>
                  <a href="#servicios">{t("nav_services")}</a>
                </li>
                <li>
                  <a href="#catalogo">{t("nav_catalog")}</a>
                </li>
                <li>
                  <a href="#proceso">{t("nav_process")}</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>{t("nav_services")}</h5>
              <ul>
                <li>
                  <a href="#servicios">{t("footer_svc1")}</a>
                </li>
                <li>
                  <a href="#servicios">{t("footer_svc2")}</a>
                </li>
                <li>
                  <a href="#servicios">{t("footer_svc3")}</a>
                </li>
                <li>
                  <a href="#servicios">{t("footer_svc4")}</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>{t("nav_contact")}</h5>
              <ul>
                <li>
                  <a href={WA} target="_blank" rel="noreferrer">
                    829-862-2291
                  </a>
                </li>
                <li>
                  <a href="mailto:ventas@camvexrd.com">ventas@camvexrd.com</a>
                </li>
                <li>
                  <a href="https://instagram.com/camvexmedicalsolutions" target="_blank" rel="noreferrer">
                    @camvexmedicalsolutions
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>
              © {year} CAMVEX Medical Solutions SRL. {t("footer_rights")}
            </span>
            <span>{t("footer_copy_location")}</span>
          </div>
        </div>
      </footer>

      <a href={WA} target="_blank" rel="noreferrer" className="wa-float" aria-label={t("hero_cta_wa")}>
        <svg viewBox="0 0 32 32">
          <path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 1.9 6.5L4 29l7.7-1.8c1.9 1 4 1.6 6.3 1.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-2 0-3.9-.5-5.5-1.5l-.4-.2-4.6 1.1 1.1-4.5-.3-.4C5.2 17.7 4.6 16.4 4.6 15 4.6 8.8 9.7 3.7 16 3.7S27.4 8.8 27.4 15 22.3 24.8 16 24.8zm6.1-8.3c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2s-1 1.1-1.2 1.4c-.2.2-.4.3-.8.1-.3-.2-1.5-.5-2.8-1.7-1-.9-1.7-2.1-1.9-2.4-.2-.3 0-.5.2-.7.2-.2.3-.4.5-.6.2-.2.2-.4.3-.6.1-.2 0-.5 0-.6-.1-.2-.8-1.9-1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-1 .5-.3.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.2 2.6 4 6.3 5.5.9.4 1.6.6 2.1.7.9.3 1.7.2 2.3.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z" />
        </svg>
      </a>
    </div>
  )
}
