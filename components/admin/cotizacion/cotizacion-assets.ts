// Image loading for the quotation exports. Reuses the ficha helpers, which
// pre-fetch images in the browser so react-pdf / docx receive ready-to-embed
// bytes (remote Blob URLs and app-relative paths fail at render time otherwise).

import { toDataUrl, fetchImageBytes, FICHA_LOGO_URL, type ImageBytes } from "../ficha/ficha-assets"
import type { QuoteItem } from "@/app/admin/actions/quotations"

export const COTIZACION_LOGO_URL = FICHA_LOGO_URL

/** Resolve the logo + every item image as data URLs (for PDF and HTML preview). */
export async function resolveQuoteImages(
  items: QuoteItem[],
): Promise<{ logo: string | null; images: (string | null)[] }> {
  const [logo, images] = await Promise.all([
    toDataUrl(COTIZACION_LOGO_URL),
    Promise.all(items.map((it) => (it.image ? toDataUrl(it.image) : Promise.resolve(null)))),
  ])
  return { logo, images }
}

/** Resolve the logo + every item image as raw bytes (for the Word document). */
export async function resolveQuoteImageBytes(
  items: QuoteItem[],
): Promise<{ logo: ImageBytes | null; images: (ImageBytes | null)[] }> {
  const [logo, images] = await Promise.all([
    fetchImageBytes(COTIZACION_LOGO_URL),
    Promise.all(items.map((it) => (it.image ? fetchImageBytes(it.image) : Promise.resolve(null)))),
  ])
  return { logo, images }
}
