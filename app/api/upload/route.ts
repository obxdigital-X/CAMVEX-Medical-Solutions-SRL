import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"

// Accepts an image file and stores it in the public Blob store, returning its
// public URL. Restricted to authenticated admin/editor users so random visitors
// can't upload to the store.
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

    const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
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
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
