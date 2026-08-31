"use client"

import { useEffect, useState } from "react"
import type { Quotation } from "@/app/admin/actions/quotations"
import { resolveQuoteImages } from "./cotizacion-assets"
import { CONTACT, computeTotals, formatMoney, formatLongDate, lineTotal } from "./cotizacion-shared"

// HTML/CSS replica of the quotation PDF. Rendered instead of an embedded PDF
// because Chrome blocks the native PDF plugin inside the nested v0 preview
// iframe. The download buttons still generate the real PDF/Word files.
export default function CotizacionPreview({ quote }: { quote: Quotation }) {
  const [assets, setAssets] = useState<{ logo: string | null; images: (string | null)[] } | null>(null)

  useEffect(() => {
    let active = true
    setAssets(null)
    resolveQuoteImages(quote.items).then((res) => {
      if (active) setAssets(res)
    })
    return () => {
      active = false
    }
  }, [quote.items])

  const totals = computeTotals(quote)
  const clientLines = [
    quote.clientContact ? `Att.: ${quote.clientContact}` : "",
    quote.clientEmail,
    quote.clientPhone,
  ].filter(Boolean)

  return (
    <div className="cot-doc-scroll">
      <article className="cot-doc" aria-label="Vista previa de la cotización">
        <div className="cot-doc-stripe" />

        <header className="cot-doc-header">
          <div className="cot-doc-header-block" />
          <div className="cot-doc-header-top">
            {assets?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cot-doc-logo" src={assets.logo || "/placeholder.svg"} alt="CAMVEX Medical Solutions" />
            ) : (
              <span className="cot-doc-logo-fallback">CAMVEX MEDICAL SOLUTIONS</span>
            )}
            <span className="cot-doc-kicker">COTIZACIÓN</span>
          </div>
          <div className="cot-doc-header-row">
            <div>
              <h1 className="cot-doc-number">{quote.number || "COT-000"}</h1>
              <div className="cot-doc-title-accent" />
              {quote.title ? <p className="cot-doc-subject">{quote.title}</p> : null}
            </div>
            <div className="cot-doc-header-meta">
              <span className="cot-doc-meta-label">FECHA</span>
              <span className="cot-doc-meta-value">{formatLongDate(quote.createdAt)}</span>
              {quote.validityDays > 0 ? (
                <>
                  <span className="cot-doc-meta-label">VÁLIDA POR</span>
                  <span className="cot-doc-meta-value">{quote.validityDays} días</span>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <div className="cot-doc-body">
          <div className="cot-doc-parties">
            <div className="cot-doc-client">
              <span className="cot-doc-client-label">PREPARADO PARA</span>
              <span className="cot-doc-client-name">{quote.clientName || "Cliente"}</span>
              {clientLines.map((l, i) => (
                <span className="cot-doc-client-line" key={i}>
                  {l}
                </span>
              ))}
            </div>
            {quote.preparedBy || quote.preparedByContact ? (
              <div className="cot-doc-client cot-doc-preparer">
                <span className="cot-doc-client-label">PREPARADO POR</span>
                {quote.preparedBy ? (
                  <span className="cot-doc-client-name">{quote.preparedBy}</span>
                ) : null}
                {quote.preparedByContact ? (
                  <span className="cot-doc-client-line">{quote.preparedByContact}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="cot-doc-sectitle">
            <span className="cot-doc-marker" />
            <span>DETALLE DE LA COTIZACIÓN</span>
          </div>

          <table className="cot-doc-table">
            <thead>
              <tr>
                <th className="cot-c-idx">#</th>
                <th className="cot-c-img">IMAGEN</th>
                <th className="cot-c-desc">DESCRIPCIÓN</th>
                <th className="cot-c-qty">CANT.</th>
                <th className="cot-c-price">PRECIO UNIT.</th>
                <th className="cot-c-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.length ? (
                quote.items.map((it, i) => {
                  const img = assets?.images?.[i]
                  return (
                    <tr key={i}>
                      <td className="cot-c-idx">{i + 1}</td>
                      <td className="cot-c-img">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img || "/placeholder.svg"} alt={it.description || "Producto"} />
                        ) : (
                          <span className="cot-doc-img-empty" />
                        )}
                      </td>
                      <td className="cot-c-desc">
                        <strong>{it.description || "—"}</strong>
                      </td>
                      <td className="cot-c-qty">{it.quantity}</td>
                      <td className="cot-c-price">{formatMoney(it.unitPrice, quote.currency)}</td>
                      <td className="cot-c-total">{formatMoney(lineTotal(it), quote.currency)}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="cot-doc-muted" style={{ textAlign: "center", padding: "18px" }}>
                    Sin artículos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="cot-doc-totals-wrap">
            <div className="cot-doc-totals">
              <div className="cot-doc-total-row">
                <span>Subtotal</span>
                <strong>{formatMoney(totals.subtotal, quote.currency)}</strong>
              </div>
              {quote.taxEnabled ? (
                <div className="cot-doc-total-row">
                  <span>ITBIS ({quote.taxRate}%)</span>
                  <strong>{formatMoney(totals.tax, quote.currency)}</strong>
                </div>
              ) : null}
              <div className="cot-doc-grand">
                <span>TOTAL</span>
                <strong>{formatMoney(totals.total, quote.currency)}</strong>
              </div>
            </div>
          </div>

          {quote.notes ? (
            <>
              <div className="cot-doc-sectitle">
                <span className="cot-doc-marker" />
                <span>NOTAS Y CONDICIONES</span>
              </div>
              <p className="cot-doc-notes">{quote.notes}</p>
            </>
          ) : null}
          {quote.validityDays > 0 ? (
            <p className="cot-doc-validity">
              Esta cotización tiene una validez de {quote.validityDays} días a partir de la fecha de emisión. Precios
              expresados en {quote.currency === "USD" ? "dólares (US$)" : "pesos dominicanos (RD$)"}.
            </p>
          ) : null}
        </div>

        <footer className="cot-doc-footer">
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
