import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  ImageRun,
  VerticalAlign,
  type ParagraphChild,
} from "docx"
import type { Quotation } from "@/app/admin/actions/quotations"
import { resolveQuoteImageBytes } from "./cotizacion-assets"
import { CONTACT, computeTotals, formatMoney, formatLongDate, lineTotal } from "./cotizacion-shared"

// Brand colors as bare hex (docx does not use a leading #).
const NAVY = "02265A"
const CYAN = "0B84C4"
const SLATE = "5B6B80"
const PAPER = "F4F7FA"
const PAPER_2 = "EAF0F6"
const WHITE = "FFFFFF"
const INK = "0F1B2D"

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: CYAN, space: 4 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 22, characterSpacing: 30 })],
  })
}

function cell(children: Paragraph[], opts: { width: number; fill?: string } = { width: 20 }): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    verticalAlign: VerticalAlign.CENTER,
    children,
  })
}

function p(runs: ParagraphChild[], alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph {
  return new Paragraph({ alignment, children: runs })
}

export async function buildCotizacionDocx(quote: Quotation): Promise<Blob> {
  const children: (Paragraph | Table)[] = []
  const totals = computeTotals(quote)

  const { logo, images } = await resolveQuoteImageBytes(quote.items)

  // Header band
  if (logo) {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { before: 40, after: 20 },
        children: [new ImageRun({ type: logo.type, data: logo.data, transformation: { width: 200, height: 41 } })],
      }),
    )
  } else {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { before: 40, after: 0 },
        children: [new TextRun({ text: "CAMVEX MEDICAL SOLUTIONS", bold: true, color: WHITE, size: 18, characterSpacing: 20 })],
      }),
    )
  }
  children.push(
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: "COTIZACIÓN", bold: true, color: CYAN, size: 16, characterSpacing: 60 })],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      spacing: { before: 10, after: 20 },
      children: [new TextRun({ text: quote.number || "COT-000", bold: true, color: WHITE, size: 40 })],
    }),
  )
  if (quote.title) {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { after: 40 },
        children: [new TextRun({ text: quote.title, bold: true, color: CYAN, size: 20 })],
      }),
    )
  }
  children.push(
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `Fecha: ${formatLongDate(quote.createdAt)}`, color: WHITE, size: 18 }),
        ...(quote.validityDays > 0
          ? [new TextRun({ text: `     Válida por: ${quote.validityDays} días`, color: WHITE, size: 18 })]
          : []),
      ],
    }),
  )

  // Client block
  children.push(sectionHeading("PREPARADO PARA"))
  children.push(new Paragraph({ children: [new TextRun({ text: quote.clientName || "Cliente", bold: true, color: NAVY, size: 24 })] }))
  const clientLines = [
    quote.clientContact ? `Att.: ${quote.clientContact}` : "",
    quote.clientEmail,
    quote.clientPhone,
  ].filter(Boolean)
  clientLines.forEach((l) =>
    children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l, color: INK, size: 20 })] })),
  )

  // Prepared by block
  if (quote.preparedBy || quote.preparedByContact) {
    children.push(sectionHeading("PREPARADO POR"))
    if (quote.preparedBy) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: quote.preparedBy, bold: true, color: NAVY, size: 22 })] }),
      )
    }
    if (quote.preparedByContact) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: quote.preparedByContact, color: INK, size: 20 })],
        }),
      )
    }
  }

  // Items table
  children.push(sectionHeading("DETALLE DE LA COTIZACIÓN"))
  const headerCell = (t: string, w: number, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    cell([p([new TextRun({ text: t, bold: true, color: WHITE, size: 16 })], align)], { width: w, fill: NAVY })

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("#", 6, AlignmentType.CENTER),
        headerCell("IMAGEN", 16, AlignmentType.CENTER),
        headerCell("DESCRIPCIÓN", 38),
        headerCell("CANT.", 10, AlignmentType.CENTER),
        headerCell("PRECIO UNIT.", 15, AlignmentType.RIGHT),
        headerCell("TOTAL", 15, AlignmentType.RIGHT),
      ],
    }),
  ]
  quote.items.forEach((it, i) => {
    const fill = i % 2 === 1 ? PAPER : WHITE
    const imgBytes = images[i]
    const imgPara = imgBytes
      ? p(
          [new ImageRun({ type: imgBytes.type, data: imgBytes.data, transformation: { width: 48, height: 48 } })],
          AlignmentType.CENTER,
        )
      : p([new TextRun({ text: "—", color: SLATE, size: 18 })], AlignmentType.CENTER)
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell([p([new TextRun({ text: String(i + 1), color: SLATE, size: 18 })], AlignmentType.CENTER)], { width: 6, fill }),
          cell([imgPara], { width: 16, fill }),
          cell([p([new TextRun({ text: it.description || "—", bold: true, color: INK, size: 19 })])], { width: 38, fill }),
          cell([p([new TextRun({ text: String(it.quantity), color: INK, size: 19 })], AlignmentType.CENTER)], { width: 10, fill }),
          cell([p([new TextRun({ text: formatMoney(it.unitPrice, quote.currency), color: INK, size: 19 })], AlignmentType.RIGHT)], { width: 15, fill }),
          cell([p([new TextRun({ text: formatMoney(lineTotal(it), quote.currency), bold: true, color: NAVY, size: 19 })], AlignmentType.RIGHT)], { width: 15, fill }),
        ],
      }),
    )
  })

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        left: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        right: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
      },
      rows,
    }),
  )

  // Totals table (right-aligned two-column)
  const totalRow = (label: string, value: string, opts: { bold?: boolean; fill?: string; labelColor?: string; valueColor?: string } = {}) =>
    new TableRow({
      cantSplit: true,
      children: [
        cell([p([new TextRun({ text: label, bold: opts.bold, color: opts.labelColor || SLATE, size: 20 })])], { width: 55, fill: opts.fill }),
        cell([p([new TextRun({ text: value, bold: true, color: opts.valueColor || INK, size: 20 })], AlignmentType.RIGHT)], { width: 45, fill: opts.fill }),
      ],
    })
  const totalsRows: TableRow[] = [totalRow("Subtotal", formatMoney(totals.subtotal, quote.currency))]
  if (quote.taxEnabled) totalsRows.push(totalRow(`ITBIS (${quote.taxRate}%)`, formatMoney(totals.tax, quote.currency)))
  totalsRows.push(
    totalRow("TOTAL", formatMoney(totals.total, quote.currency), { bold: true, fill: NAVY, labelColor: WHITE, valueColor: WHITE }),
  )
  children.push(
    new Paragraph({ spacing: { before: 160 }, children: [] }),
    new Table({
      width: { size: 50, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.RIGHT,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAPER_2 },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
      rows: totalsRows,
    }),
  )

  // Notes
  if (quote.notes) {
    children.push(sectionHeading("NOTAS Y CONDICIONES"))
    children.push(new Paragraph({ children: [new TextRun({ text: quote.notes, color: INK, size: 20 })] }))
  }
  if (quote.validityDays > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({
            text: `Esta cotización tiene una validez de ${quote.validityDays} días a partir de la fecha de emisión. Precios expresados en ${quote.currency === "USD" ? "dólares (US$)" : "pesos dominicanos (RD$)"}.`,
            color: SLATE,
            size: 17,
            italics: true,
          }),
        ],
      }),
    )
  }

  // Footer / contact
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: PAPER_2, space: 6 } },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${CONTACT.web}     ·     ${CONTACT.phone}     ·     ${CONTACT.email}`, color: SLATE, size: 18 }),
      ],
    }),
  )

  const doc = new Document({
    creator: "CAMVEX Medical Solutions",
    title: quote.number || "Cotización",
    sections: [
      {
        properties: {
          // US Letter (8.5 x 11 in) in twips, with 0.5in margins.
          page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}
