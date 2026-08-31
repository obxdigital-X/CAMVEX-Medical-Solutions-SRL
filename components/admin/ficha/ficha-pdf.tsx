"use client"

import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { DataSheet } from "@/app/admin/actions/data-sheets"

// CAMVEX brand palette (kept in sync with admin.css / the marketing site).
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
const RUN_H = 40

const styles = StyleSheet.create({
  page: {
    paddingTop: RUN_H,
    paddingBottom: 58,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.4,
  },
  // Pulls the full page-1 header back up flush with the top edge, cancelling
  // the page-level paddingTop that reserves space for the running header.
  headerShift: { marginTop: -RUN_H },
  // Thin accent stripe along the very top edge.
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
  pageNum: { position: "absolute", bottom: 62, right: 36, fontSize: 8, color: SLATE },

  // Header band
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingTop: 16,
    paddingBottom: 18,
    position: "relative",
  },
  // Decorative deep-navy block on the right of the header for depth.
  headerBlock: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 150,
    backgroundColor: NAVY_DEEP,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  logo: { width: 138, height: 28, objectFit: "contain" },
  logoFallback: { color: WHITE, fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  kickerWrap: {
    borderLeft: `2 solid ${CYAN_LIGHT}`,
    paddingLeft: 8,
  },
  headerKicker: { color: CYAN_LIGHT, fontSize: 9, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  title: { color: WHITE, fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, lineHeight: 1.1 },
  titleAccent: { width: 48, height: 3, backgroundColor: CYAN_LIGHT, marginTop: 6, marginBottom: 2 },
  subtitle: { color: CYAN_LIGHT, fontSize: 10, letterSpacing: 2, marginTop: 6, fontFamily: "Helvetica-Bold" },

  body: { paddingHorizontal: 36, paddingTop: 16 },
  // Intro paragraph with a cyan left accent bar.
  introWrap: { flexDirection: "row", marginBottom: 10 },
  introBar: { width: 3, backgroundColor: CYAN, marginRight: 12, borderRadius: 2 },
  intro: { flex: 1, fontSize: 10.5, color: SLATE, lineHeight: 1.5 },

  // Section title: small cyan square marker + label + hairline underline.
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    paddingBottom: 4,
    borderBottom: `1 solid ${PAPER_2}`,
  },
  sectionMarker: { width: 8, height: 8, backgroundColor: CYAN, marginRight: 8 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1.5 },

  // Two-column row: image + identification
  topRow: { flexDirection: "row", gap: 18, marginBottom: 10 },
  imageWrap: {
    width: 150,
    backgroundColor: PAPER,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    border: `1 solid ${PAPER_2}`,
  },
  productImage: { width: 122, height: 140, objectFit: "contain" },
  imagePlaceholder: {
    width: 122,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    color: SLATE,
    fontSize: 9,
  },
  idBox: { flex: 1 },
  idRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  idLabel: { width: 110, color: SLATE, fontSize: 9.5 },
  idValue: { flex: 1, color: INK, fontFamily: "Helvetica-Bold", fontSize: 10.5 },

  section: { marginBottom: 10 },

  // Characteristics bullet list
  bulletRow: { flexDirection: "row", marginBottom: 4, paddingRight: 12 },
  bulletDot: { color: CYAN, marginRight: 8, fontFamily: "Helvetica-Bold", fontSize: 11 },
  bulletText: { flex: 1, color: INK, fontSize: 10 },

  // Specs table
  table: { borderRadius: 8, overflow: "hidden", border: `1 solid ${PAPER_2}` },
  tableHead: { flexDirection: "row", backgroundColor: NAVY },
  th: { color: WHITE, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1, paddingVertical: 9, paddingHorizontal: 10 },
  tr: { flexDirection: "row", borderTop: `1 solid ${PAPER_2}` },
  trAlt: { backgroundColor: PAPER },
  tdParam: { width: "42%", paddingVertical: 8, paddingHorizontal: 10, color: NAVY, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  tdValue: { width: "58%", paddingVertical: 8, paddingHorizontal: 10, color: INK, fontSize: 9.5 },

  // Presentation + applications row
  twoCol: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  presentBox: {
    backgroundColor: PAPER,
    borderRadius: 8,
    padding: 14,
    borderLeft: `3 solid ${CYAN}`,
    color: INK,
    fontSize: 10,
    lineHeight: 1.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    backgroundColor: WHITE,
    color: NAVY,
    borderRadius: 20,
    border: `1 solid ${CYAN}`,
    paddingVertical: 5,
    paddingHorizontal: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },

  // Footer band
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

const CONTACT = {
  web: "www.camvexmedicalsolutions.com",
  phone: "829-862-2291",
  email: "Ventas@camvexrd.com",
}

export function FichaPdfDocument({
  sheet,
  logo,
  image,
}: {
  sheet: DataSheet
  logo?: string | null
  image?: string | null
}) {
  const idPairs: { label: string; value: string }[] = [
    { label: "Nombre", value: sheet.title },
    { label: "Fórmula química", value: sheet.formula },
    { label: "Fabricante", value: sheet.manufacturer },
  ].filter((p) => p.value)

  const SectionTitle = ({ children }: { children: string }) => (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionMarker} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  )

  return (
    <Document title={sheet.title || "Ficha técnica"} author="CAMVEX Medical Solutions">
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
                  <Text style={styles.runKicker}>FICHA TÉCNICA · {(sheet.title || "Producto").toUpperCase()}</Text>
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
              <Text style={styles.headerKicker}>FICHA TÉCNICA</Text>
            </View>
          </View>
          <Text style={styles.title}>{sheet.title || "Producto"}</Text>
          <View style={styles.titleAccent} />
          {sheet.subtitle ? <Text style={styles.subtitle}>{sheet.subtitle.toUpperCase()}</Text> : null}
        </View>

        <View style={styles.body}>
          {sheet.intro ? (
            <View style={styles.introWrap}>
              <View style={styles.introBar} />
              <Text style={styles.intro}>{sheet.intro}</Text>
            </View>
          ) : null}

          {/* Image + identification */}
          <View style={styles.topRow} wrap={false}>
            <View style={styles.imageWrap}>
              {image ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.productImage} src={image} />
              ) : (
                <Text style={styles.imagePlaceholder}>Sin imagen</Text>
              )}
            </View>
            <View style={styles.idBox}>
              <SectionTitle>IDENTIFICACIÓN DEL PRODUCTO</SectionTitle>
              {idPairs.length ? (
                idPairs.map((p) => (
                  <View style={styles.idRow} key={p.label}>
                    <Text style={styles.idLabel}>{p.label}:</Text>
                    <Text style={styles.idValue}>{p.value}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.bulletText}>Sin datos de identificación.</Text>
              )}
            </View>
          </View>

          {/* Characteristics */}
          {sheet.characteristics.length ? (
            <View style={styles.section}>
              <SectionTitle>CARACTERÍSTICAS</SectionTitle>
              {sheet.characteristics.map((c, i) => (
                <View style={styles.bulletRow} key={i}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Technical specifications table */}
          {sheet.specs.length ? (
            <View style={styles.section}>
              <SectionTitle>ESPECIFICACIONES TÉCNICAS</SectionTitle>
              <View style={styles.table}>
                <View style={styles.tableHead} fixed>
                  <Text style={[styles.th, { width: "42%" }]}>PARÁMETRO</Text>
                  <Text style={[styles.th, { width: "58%" }]}>ESPECIFICACIÓN</Text>
                </View>
                {sheet.specs.map((row, i) => (
                  <View style={[styles.tr, ...(i % 2 === 1 ? [styles.trAlt] : [])]} key={i} wrap={false}>
                    <Text style={styles.tdParam}>{row.param}</Text>
                    <Text style={styles.tdValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Presentation + applications — kept on one page as a single block. */}
          {sheet.presentation || sheet.applications.length ? (
            <View style={styles.twoCol} wrap={false}>
              {sheet.presentation ? (
                <View style={styles.col}>
                  <SectionTitle>PRESENTACIÓN</SectionTitle>
                  <Text style={styles.presentBox}>{sheet.presentation}</Text>
                </View>
              ) : null}
              {sheet.applications.length ? (
                <View style={styles.col}>
                  <SectionTitle>APLICACIONES</SectionTitle>
                  <View style={styles.chips}>
                    {sheet.applications.map((a, i) => (
                      <Text style={styles.chip} key={i}>
                        {a}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
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
