// Helpers to load images for the data-sheet exports.
//
// react-pdf's <Image> and docx's ImageRun cannot reliably load remote/relative
// URLs at render time (cross-origin Blob URLs and app-relative paths fail
// silently, which blanks the whole PDF preview). To avoid that, we pre-fetch
// every image in the browser and hand the renderers ready-to-embed bytes:
//   - PDF  -> base64 data URLs
//   - Word -> ArrayBuffer + detected format

export type ImageBytes = { data: ArrayBuffer; type: "png" | "jpg" | "gif" | "bmp" }

/** Absolute-from-root path to the white CAMVEX logo used in the header. */
export const FICHA_LOGO_URL = "/assets/camvex-logo-white.png"

function detectType(contentType: string, url: string): ImageBytes["type"] {
  const s = `${contentType} ${url}`.toLowerCase()
  if (s.includes("png")) return "png"
  if (s.includes("gif")) return "gif"
  if (s.includes("bmp")) return "bmp"
  return "jpg" // jpg / jpeg and unknown fall back to jpg
}

/** Fetch a URL and return it as a base64 data URL (for react-pdf). Null on failure. */
export async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Fetch a URL and return raw bytes + detected type (for docx ImageRun). Null on failure. */
export async function fetchImageBytes(url: string): Promise<ImageBytes | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = detectType(res.headers.get("content-type") || "", url)
    const data = await res.arrayBuffer()
    return { data, type }
  } catch {
    return null
  }
}

/** Resolve the logo + product image as data URLs for the PDF document. */
export async function resolveFichaImages(image: string): Promise<{ logo: string | null; image: string | null }> {
  const [logo, product] = await Promise.all([toDataUrl(FICHA_LOGO_URL), image ? toDataUrl(image) : Promise.resolve(null)])
  return { logo, image: product }
}
