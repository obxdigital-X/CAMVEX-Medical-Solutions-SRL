"use client"

import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { Quotation } from "@/app/admin/actions/quotations"
import { CONTACT, computeTotals, formatMoney, formatLongDate, lineTotal } from "./cotizacion-shared"

// CAMVEX brand palette (kept in sync with admin.css / the ficha template).
const NAVY = "#02265a"
const NAVY_DEEP = "#041a3d"
const CYAN = "#0b84c4"
const CYAN_LIGHT = "#38c1ea"
const PAPER = "#f4f7fa"
const PAPER_2 = "#e7eef5"
const SLATE = "#5b6b80"
const INK = "#0f1b2d"
const WHITE = "#ffffff"

// Height reserved at the top of every page for the compact running header
// that appears on continuation pages (page 2+).
const RUN_H = 46

const styles = StyleSheet.create({
  page: { paddingTop: RUN_H, paddingBottom: 82, fontSize: 10, fontFamily: "Helvetica", color: INK, lineHeight: 1.45 },
  // Pulls the full page-1 header back up so it stays flush with the top edge,
  // cancelling the page-level paddingTop that reserves space for page 2+.
  headerShift: { marginTop: -RUN_H },
  topStripe: { height: 6, backgroundColor: CYAN },

  // Compact running header, pinned to the top of continuation pages only.
  runHead: { position: "absolute", top: 0, left: 0, right: 0 },
  runStripe: { height: 4, backgroundColor: CYAN },
  runInner: {
    backgroundColor: NAVY,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 10,
  },
  runLogo: { width: 118, height: 24, objectFit: "contain" },
  runLogoFallback: { color: WHITE, fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  runKicker: { color: CYAN_LIGHT, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  pageNum: { position: "absolute", bottom: 88, right: 36, fontSize: 8, color: SLATE },

  header: { backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 26, paddingBottom: 28, position: "relative" },
  headerBlock: { position: "absolute", top: 0, bottom: 0, right: 0, width: 150, backgroundColor: NAVY_DEEP },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { width: 150, height: 31, objectFit: "contain" },
  logoFallback: { color: WHITE, fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  kickerWrap: { borderLeft: `2 solid ${CYAN_LIGHT}`, paddingLeft: 8 },
  headerKicker: { color: CYAN_LIGHT, fontSize: 9, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  quoteNumber: { color: WHITE, fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  titleAccent: { width: 54, height: 3, backgroundColor: CYAN_LIGHT, marginTop: 8 },
  quoteSubject: { color: CYAN_LIGHT, fontSize: 10.5, marginTop: 8, fontFamily: "Helvetica-Bold" },
  headerMeta: { alignItems: "flex-end" },
  headerMetaLabel: { color: CYAN_LIGHT, fontSize: 7.5, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" },
  headerMetaValue: { color: WHITE, fontSize: 10, marginBottom: 6, fontFamily: "Helvetica-Bold" },

  body: { paddingHorizontal: 36, paddingTop: 22 },

  // Client block
  partiesRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  partyCol: { flex: 1, marginBottom: 0 },
  clientBox: {
    backgroundColor: PAPER,
    borderRadius: 8,
    borderLeft: `3 solid ${CYAN}`,
    padding: 14,
    marginBottom: 20,
  },
  clientLabel: { color: SLATE, fontSize: 8, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  clientName: { color: NAVY, fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  clientLine: { color: INK, fontSize: 9.5, marginTop: 2 },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1 solid ${PAPER_2}`,
  },
  sectionMarker: { width: 9, height: 9, backgroundColor: CYAN, marginRight: 8 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1.5 },

  // Items table
  table: { borderRadius: 8, overflow: "hidden", border: `1 solid ${PAPER_2}`, marginBottom: 18 },
  tableHead: { flexDirection: "row", backgroundColor: NAVY },
  th: { color: WHITE, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, paddingVertical: 9, paddingHorizontal: 8 },
  tr: { flexDirection: "row", borderTop: `1 solid ${PAPER_2}`, alignItems: "center", minHeight: 40 },
  trAlt: { backgroundColor: PAPER },
  td: { fontSize: 9, paddingVertical: 8, paddingHorizontal: 8, color: INK },
  cIdx: { width: "6%", textAlign: "center", color: SLATE },
  cImg: { width: "14%", alignItems: "center", justifyContent: "center", paddingVertical: 5 },
  cDesc: { width: "40%" },
  cQty: { width: "10%", textAlign: "center" },
  cPrice: { width: "15%", textAlign: "right" },
  cTotal: { width: "15%", textAlign: "right", fontFamily: "Helvetica-Bold", color: NAVY },
  itemImg: { width: 40, height: 40, objectFit: "contain" },
  itemImgEmpty: { width: 40, height: 40, backgroundColor: PAPER_2, borderRadius: 4 },
  itemDescBold: { fontFamily: "Helvetica-Bold", color: INK, fontSize: 9.5 },

  // Totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 18 },
  totals: { width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 10 },
  totalLabel: { color: SLATE, fontSize: 10 },
  totalValue: { color: INK, fontSize: 10, fontFamily: "Helvetica-Bold" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: NAVY,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  grandLabel: { color: WHITE, fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  grandValue: { color: CYAN_LIGHT, fontSize: 12, fontFamily: "Helvetica-Bold" },

  // Notes
  notesWrap: { marginBottom: 10 },
  notesBox: { backgroundColor: PAPER, borderRadius: 8, padding: 12, borderLeft: `3 solid ${CYAN}`, color: INK, fontSize: 9.5, lineHeight: 1.5 },
  validity: { color: SLATE, fontSize: 9, marginTop: 8 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY_DEEP,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 16,
  },
  footerAccentStripe: { height: 4, backgroundColor: CYAN },
  footerText: { color: WHITE, fontSize: 9 },
  footerLabel: { color: CYAN_LIGHT, fontFamily: "Helvetica-Bold" },
})

export function CotizacionPdfDocument({
  quote,
  logo,
  images,
}: {
  quote: Quotation
  logo?: string | null
  images?: (string | null)[]
}) {
  const totals = computeTotals(quote)
  const clientLines = [
    quote.clientContact ? `Att.: ${quote.clientContact}` : "",
    quote.clientEmail,
    quote.clientPhone,
  ].filter(Boolean)

  const SectionTitle = ({ children }: { children: string }) => (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionMarker} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  )

  return (
    <Document title={quote.number || "Cotización"} author="CAMVEX Medical Solutions">
      <Page size="LETTER" style={styles.page} wrap>
        {/* Compact running header, shown only on continuation pages (2+). */}
        <View
          style={styles.runHead}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View>
                <View style={styles.runStripe} />
                <View style={styles.runInner}>
                  {logo ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image style={styles.runLogo} src={logo} />
                  ) : (
                    <Text style={styles.runLogoFallback}>CAMVEX MEDICAL SOLUTIONS</Text>
                  )}
                  <Text style={styles.runKicker}>COTIZACIÓN · {quote.number || "COT-000"}</Text>
                </View>
              </View>
            ) : null
          }
        />

        <View style={[styles.topStripe, styles.headerShift]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBlock} />
          <View style={styles.headerTop}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={logo} />
            ) : (
              <Text style={styles.logoFallback}>CAMVEX MEDICAL SOLUTIONS</Text>
            )}
            <View style={styles.kickerWrap}>
              <Text style={styles.headerKicker}>COTIZACIÓN</Text>
            </View>
          </View>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.quoteNumber}>{quote.number || "COT-000"}</Text>
              <View style={styles.titleAccent} />
              {quote.title ? <Text style={styles.quoteSubject}>{quote.title}</Text> : null}
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaLabel}>FECHA</Text>
              <Text style={styles.headerMetaValue}>{formatLongDate(quote.createdAt)}</Text>
              {quote.validityDays > 0 ? (
                <>
                  <Text style={styles.headerMetaLabel}>VÁLIDA POR</Text>
                  <Text style={styles.headerMetaValue}>{quote.validityDays} días</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Parties */}
          <View style={styles.partiesRow}>
            <View style={[styles.clientBox, styles.partyCol]}>
              <Text style={styles.clientLabel}>PREPARADO PARA</Text>
              <Text style={styles.clientName}>{quote.clientName || "Cliente"}</Text>
              {clientLines.map((l, i) => (
                <Text style={styles.clientLine} key={i}>
                  {l}
                </Text>
              ))}
            </View>
            {quote.preparedBy || quote.preparedByContact ? (
              <View style={[styles.clientBox, styles.partyCol]}>
                <Text style={styles.clientLabel}>PREPARADO POR</Text>
                {quote.preparedBy ? <Text style={styles.clientName}>{quote.preparedBy}</Text> : null}
                {quote.preparedByContact ? <Text style={styles.clientLine}>{quote.preparedByContact}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* Items */}
          <SectionTitle>DETALLE DE LA COTIZACIÓN</SectionTitle>
          <View style={styles.table}>
            <View style={styles.tableHead} fixed>
              <Text style={[styles.th, styles.cIdx]}>#</Text>
              <Text style={[styles.th, styles.cImg]}>IMAGEN</Text>
              <Text style={[styles.th, styles.cDesc]}>DESCRIPCIÓN</Text>
              <Text style={[styles.th, styles.cQty]}>CANT.</Text>
              <Text style={[styles.th, styles.cPrice]}>PRECIO UNIT.</Text>
              <Text style={[styles.th, styles.cTotal]}>TOTAL</Text>
            </View>
            {quote.items.map((it, i) => {
              const img = images?.[i]
              return (
                <View style={[styles.tr, ...(i % 2 === 1 ? [styles.trAlt] : [])]} key={i} wrap={false}>
                  <Text style={[styles.td, styles.cIdx]}>{i + 1}</Text>
                  <View style={styles.cImg}>
                    {img ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image style={styles.itemImg} src={img} />
                    ) : (
                      <View style={styles.itemImgEmpty} />
                    )}
                  </View>
                  <View style={[styles.td, styles.cDesc]}>
                    <Text style={styles.itemDescBold}>{it.description || "—"}</Text>
                  </View>
                  <Text style={[styles.td, styles.cQty]}>{it.quantity}</Text>
                  <Text style={[styles.td, styles.cPrice]}>{formatMoney(it.unitPrice, quote.currency)}</Text>
                  <Text style={[styles.td, styles.cTotal]}>{formatMoney(lineTotal(it), quote.currency)}</Text>
                </View>
              )
            })}
          </View>

          {/* Totals */}
          <View style={styles.totalsWrap}>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatMoney(totals.subtotal, quote.currency)}</Text>
              </View>
              {quote.taxEnabled ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>ITBIS ({quote.taxRate}%)</Text>
                  <Text style={styles.totalValue}>{formatMoney(totals.tax, quote.currency)}</Text>
                </View>
              ) : null}
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>TOTAL</Text>
                <Text style={styles.grandValue}>{formatMoney(totals.total, quote.currency)}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {quote.notes ? (
            <View style={styles.notesWrap} wrap={false}>
              <SectionTitle>NOTAS Y CONDICIONES</SectionTitle>
              <Text style={styles.notesBox}>{quote.notes}</Text>
            </View>
          ) : null}
          {quote.validityDays > 0 ? (
            <Text style={styles.validity}>
              Esta cotización tiene una validez de {quote.validityDays} días a partir de la fecha de emisión. Precios
              expresados en {quote.currency === "USD" ? "dólares (US$)" : "pesos dominicanos (RD$)"}.
            </Text>
          ) : null}
        </View>

        {/* Page number, only when the document spans more than one page. */}
        <Text
          style={styles.pageNum}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : ""
          }
        />

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={[styles.footerAccentStripe, { position: "absolute", top: 0, left: 0, right: 0 }]} />
          <Text style={styles.footerText}>{CONTACT.web}</Text>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>T </Text>
            {CONTACT.phone}
          </Text>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>E </Text>
            {CONTACT.email}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
