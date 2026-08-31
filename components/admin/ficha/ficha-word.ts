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
} from "docx"
import type { DataSheet } from "@/app/admin/actions/data-sheets"
import { fetchImageBytes, FICHA_LOGO_URL } from "./ficha-assets"

// Brand colors as bare hex (docx does not use a leading #).
const NAVY = "02265A"
const CYAN = "0B84C4"
const SLATE = "5B6B80"
const PAPER = "F4F7FA"
const PAPER_2 = "EAF0F6"
const WHITE = "FFFFFF"
const INK = "0F1B2D"

const CONTACT = {
  web: "www.camvexmedicalsolutions.com",
  phone: "829-862-2291",
  email: "Ventas@camvexrd.com",
}

// A section heading with a cyan underline, mirroring the PDF template.
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: CYAN, space: 4 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 22, characterSpacing: 30 })],
  })
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, color: INK, size: 21 })],
  })
}

function idLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}:  `, color: SLATE, size: 20 }),
      new TextRun({ text: value, bold: true, color: INK, size: 21 }),
    ],
  })
}

function specTable(specs: { param: string; value: string }[]): Table {
  const headerCell = (t: string, w: number) =>
    new TableCell({
      width: { size: w, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 18 })] })],
    })

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [headerCell("PARÁMETRO", 42), headerCell("ESPECIFICACIÓN", 58)],
    }),
    ...specs.map(
      (r, i) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 42, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 1 ? PAPER : WHITE },
              margins: { top: 70, bottom: 70, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: r.param, bold: true, color: NAVY, size: 19 })] })],
            }),
            new TableCell({
              width: { size: 58, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 1 ? PAPER : WHITE },
              margins: { top: 70, bottom: 70, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: r.value, color: INK, size: 19 })] })],
            }),
          ],
        }),
    ),
  ]

  return new Table({
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
  })
}

export async function buildFichaDocx(sheet: DataSheet): Promise<Blob> {
  const children: (Paragraph | Table)[] = []

  // Fetch images up front so they can be embedded (docx needs raw bytes).
  const [logoBytes, productBytes] = await Promise.all([
    fetchImageBytes(FICHA_LOGO_URL),
    sheet.image ? fetchImageBytes(sheet.image) : Promise.resolve(null),
  ])

  // Header block — logo (if available), then product name + subtitle on navy.
  if (logoBytes) {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { before: 40, after: 20 },
        children: [
          new ImageRun({
            type: logoBytes.type,
            data: logoBytes.data,
            transformation: { width: 200, height: 41 },
          }),
        ],
      }),
    )
  } else {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({ text: "CAMVEX MEDICAL SOLUTIONS", bold: true, color: WHITE, size: 18, characterSpacing: 20 }),
        ],
      }),
    )
  }
  children.push(
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({ text: "FICHA TÉCNICA", bold: true, color: CYAN, size: 16, characterSpacing: 60 }),
      ],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      spacing: { before: 20, after: 40 },
      children: [new TextRun({ text: (sheet.title || "Producto").toUpperCase(), bold: true, color: WHITE, size: 44 })],
    }),
  )
  if (sheet.subtitle) {
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
        spacing: { after: 80 },
        children: [new TextRun({ text: sheet.subtitle.toUpperCase(), bold: true, color: CYAN, size: 20, characterSpacing: 40 })],
      }),
    )
  }

  if (sheet.intro) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 120 },
        children: [new TextRun({ text: sheet.intro, color: SLATE, size: 21 })],
      }),
    )
  }

  // Product image, centered under the intro.
  if (productBytes) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            type: productBytes.type,
            data: productBytes.data,
            transformation: { width: 180, height: 216 },
          }),
        ],
      }),
    )
  }

  // Identification
  const idPairs = [
    { label: "Nombre", value: sheet.title },
    { label: "Fórmula química", value: sheet.formula },
    { label: "Fabricante", value: sheet.manufacturer },
  ].filter((p) => p.value)
  if (idPairs.length) {
    children.push(sectionHeading("IDENTIFICACIÓN DEL PRODUCTO"))
    idPairs.forEach((p) => children.push(idLine(p.label, p.value)))
  }

  // Characteristics
  if (sheet.characteristics.length) {
    children.push(sectionHeading("CARACTERÍSTICAS"))
    sheet.characteristics.forEach((c) => children.push(bullet(c)))
  }

  // Specs
  if (sheet.specs.length) {
    children.push(sectionHeading("ESPECIFICACIONES TÉCNICAS"))
    children.push(specTable(sheet.specs))
  }

  // Presentation
  if (sheet.presentation) {
    children.push(sectionHeading("PRESENTACIÓN"))
    children.push(
      new Paragraph({ children: [new TextRun({ text: sheet.presentation, color: INK, size: 21 })] }),
    )
  }

  // Applications
  if (sheet.applications.length) {
    children.push(sectionHeading("APLICACIONES"))
    children.push(
      new Paragraph({
        children: [new TextRun({ text: sheet.applications.join("  ·  "), bold: true, color: NAVY, size: 20 })],
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
    title: sheet.title || "Ficha técnica",
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
