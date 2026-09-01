import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { getAdminUser } from "@/lib/admin-auth"

// This route needs the Node.js runtime because it uses `sharp` for image
// processing (not available on the Edge runtime).
export const runtime = "nodejs"

// Largest dimension we keep. Product cards, logos and previews never need more
// than this on the web, so anything bigger is downscaled to save transfer.
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 82
// Cache the optimized asset on the CDN/browser for a year. Blob URLs are
// immutable (random suffix), so a long max-age is safe and avoids re-fetching.
const ONE_YEAR = 60 * 60 * 24 * 365

// Accepts an image file, OPTIMIZES it (resize + WebP), and stores it in the
// public Blob store, returning its public URL. The browser then loads the image
// directly from the Blob CDN — the backend never proxies image bytes. Restricted
// to authenticated admin/editor users so random visitors can't upload.
export async function POST(request: NextRequest) {
  const me = await getAdminUser()
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 })
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen." }, { status: 400 })
    }
    // Guard against very large uploads (8 MB).
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "La imagen no puede superar los 8 MB." }, { status: 400 })
    }

    const isSvg = file.type === "image/svg+xml"
    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen"

    let body: Buffer | File = file
    let contentType = file.type
    let ext = file.name.split(".").pop() || "bin"

    if (!isSvg) {
      // Rasterize/optimize: honor EXIF orientation, downscale to fit within
      // MAX_DIMENSION (never upscale), and re-encode as WebP. This typically
      // cuts the stored file size by 70–90%, so every future download is
      // smaller for every visitor.
      const input = Buffer.from(await file.arrayBuffer())
      const optimized = await sharp(input)
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()
      body = optimized
      contentType = "image/webp"
      ext = "webp"
    }

    const blob = await put(`uploads/${Date.now()}-${baseName}.${ext}`, body, {
      access: "public",
      addRandomSuffix: true,
      contentType,
      cacheControlMaxAge: ONE_YEAR,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    console.log("[v0] upload error:", raw)
    // Surface a clear cause instead of a generic message. A suspended store is
    // an account/billing issue on Vercel, not something the code can fix.
    let message = "No se pudo subir la imagen."
    if (/suspended/i.test(raw)) {
      message =
        "El almacenamiento de archivos (Vercel Blob) está suspendido. Reactívalo en el panel de Vercel (Storage) para poder subir imágenes."
    } else if (/quota|limit|exceeded/i.test(raw)) {
      message = "Se alcanzó el límite de almacenamiento. Revisa tu plan de Vercel Blob."
    } else if (/unsupported image|Input (buffer|file)/i.test(raw)) {
      message = "No se pudo procesar la imagen. Prueba con otro archivo (JPG, PNG o WebP)."
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
