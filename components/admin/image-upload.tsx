"use client"

import type React from "react"
import { useRef, useState } from "react"

/**
 * Reusable image picker for the admin panels. Lets the user either upload a file
 * (stored in Vercel Blob via /api/upload) or paste an existing URL. Emits the
 * final public URL string through onChange, so callers keep storing a plain
 * string just like before.
 */
export function ImageUpload({
  value,
  onChange,
  label = "Imagen",
}: {
  value: string
  onChange: (url: string) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "No se pudo subir la imagen.")
        return
      }
      onChange(data.url as string)
    } catch {
      setError("No se pudo subir la imagen.")
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so selecting the same file again re-triggers change.
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="img-upload">
      <span className="img-upload-label">{label}</span>

      <div
        className={`img-upload-drop ${uploading ? "is-busy" : ""}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value || "/placeholder.svg"} alt="Vista previa" className="img-upload-preview" />
        ) : (
          <div className="img-upload-empty">
            <span className="img-upload-icon" aria-hidden="true">
              +
            </span>
            <span>{uploading ? "Subiendo…" : "Haz clic o arrastra una imagen"}</span>
          </div>
        )}

        {uploading && <div className="img-upload-spinner" aria-label="Subiendo" />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        style={{ display: "none" }}
      />

      <div className="img-upload-actions">
        {value && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onChange("")}
            disabled={uploading}
          >
            Quitar
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {value ? "Cambiar archivo" : "Elegir archivo"}
        </button>
      </div>

      <details className="img-upload-url">
        <summary>O pegar una URL</summary>
        <input
          type="url"
          placeholder="https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>

      {error && <div className="img-upload-error">{error}</div>}
    </div>
  )
}
