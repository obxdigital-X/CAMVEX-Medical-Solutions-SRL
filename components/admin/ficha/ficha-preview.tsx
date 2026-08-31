"use client"

import { useEffect, useState } from "react"
import type { DataSheet } from "@/app/admin/actions/data-sheets"
import { resolveFichaImages } from "./ficha-assets"

const CONTACT = {
  web: "www.camvexmedicalsolutions.com",
  phone: "829-862-2291",
  email: "Ventas@camvexrd.com",
}

// HTML/CSS replica of the PDF ficha. We render this instead of an embedded PDF
// because Chrome blocks the native PDF plugin inside nested iframes (the v0
// preview), which showed a "This page has been blocked by Chrome" screen. This
// preview always renders; the download buttons still produce the real PDF/Word.
export default function FichaPreview({ sheet }: { sheet: DataSheet }) {
  const [assets, setAssets] = useState<{ logo: string | null; image: string | null } | null>(null)

  useEffect(() => {
    let active = true
    setAssets(null)
    resolveFichaImages(sheet.image).then((res) => {
      if (active) setAssets(res)
    })
    return () => {
      active = false
    }
  }, [sheet.image])

  const idPairs = [
    { label: "Nombre", value: sheet.title },
    { label: "Fórmula química", value: sheet.formula },
    { label: "Fabricante", value: sheet.manufacturer },
  ].filter((p) => p.value)

  return (
    <div className="ficha-doc-scroll">
      <article className="ficha-doc" aria-label="Vista previa de la ficha técnica">
        <div className="ficha-doc-stripe" />

        <header className="ficha-doc-header">
          <div className="ficha-doc-header-block" />
          <div className="ficha-doc-header-top">
            {assets?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ficha-doc-logo" src={assets.logo || "/placeholder.svg"} alt="CAMVEX Medical Solutions" />
            ) : (
              <span className="ficha-doc-logo-fallback">CAMVEX MEDICAL SOLUTIONS</span>
            )}
            <span className="ficha-doc-kicker">FICHA TÉCNICA</span>
          </div>
          <h1 className="ficha-doc-title">{sheet.title || "Producto"}</h1>
          <div className="ficha-doc-title-accent" />
          {sheet.subtitle ? <p className="ficha-doc-subtitle">{sheet.subtitle.toUpperCase()}</p> : null}
        </header>

        <div className="ficha-doc-body">
          {sheet.intro ? (
            <div className="ficha-doc-intro">
              <p>{sheet.intro}</p>
            </div>
          ) : null}

          <div className="ficha-doc-toprow">
            <div className="ficha-doc-image">
              {assets?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.image || "/placeholder.svg"} alt={sheet.title || "Producto"} />
              ) : (
                <span className="ficha-doc-image-empty">
                  {assets === null ? "Cargando imagen…" : "Sin imagen"}
                </span>
              )}
            </div>
            <div className="ficha-doc-idbox">
              <FichaSectionTitle>IDENTIFICACIÓN DEL PRODUCTO</FichaSectionTitle>
              {idPairs.length ? (
                idPairs.map((p) => (
                  <div className="ficha-doc-idrow" key={p.label}>
                    <span className="ficha-doc-idlabel">{p.label}:</span>
                    <span className="ficha-doc-idvalue">{p.value}</span>
                  </div>
                ))
              ) : (
                <p className="ficha-doc-muted">Sin datos de identificación.</p>
              )}
            </div>
          </div>

          {sheet.characteristics.length ? (
            <section className="ficha-doc-section">
              <FichaSectionTitle>CARACTERÍSTICAS</FichaSectionTitle>
              <ul className="ficha-doc-bullets">
                {sheet.characteristics.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {sheet.specs.length ? (
            <section className="ficha-doc-section">
              <FichaSectionTitle>ESPECIFICACIONES TÉCNICAS</FichaSectionTitle>
              <table className="ficha-doc-table">
                <thead>
                  <tr>
                    <th>PARÁMETRO</th>
                    <th>ESPECIFICACIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.specs.map((row, i) => (
                    <tr key={i}>
                      <td className="ficha-doc-td-param">{row.param}</td>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {sheet.presentation || sheet.applications.length ? (
            <div className="ficha-doc-twocol">
              {sheet.presentation ? (
                <section className="ficha-doc-col">
                  <FichaSectionTitle>PRESENTACIÓN</FichaSectionTitle>
                  <p className="ficha-doc-present">{sheet.presentation}</p>
                </section>
              ) : null}
              {sheet.applications.length ? (
                <section className="ficha-doc-col">
                  <FichaSectionTitle>APLICACIONES</FichaSectionTitle>
                  <div className="ficha-doc-chips">
                    {sheet.applications.map((a, i) => (
                      <span className="ficha-doc-chip" key={i}>
                        {a}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="ficha-doc-footer">
          <span>{CONTACT.web}</span>
          <span>
            <strong>T </strong>
            {CONTACT.phone}
          </span>
          <span>
            <strong>E </strong>
            {CONTACT.email}
          </span>
        </footer>
      </article>
    </div>
  )
}

function FichaSectionTitle({ children }: { children: string }) {
  return (
    <div className="ficha-doc-sectitle">
      <span className="ficha-doc-marker" />
      <span>{children}</span>
    </div>
  )
}
