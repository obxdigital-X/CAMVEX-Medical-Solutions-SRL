"use client"

import "flag-icons/css/flag-icons.min.css"
import { useState } from "react"
import { updateContent, getContentForLang, type ContentMap } from "@/app/admin/actions/content"
import { CONTENT_FIELDS } from "@/lib/site-content"
import { LANGS, LANG_META, DEFAULT_LANG, type Lang } from "@/lib/i18n"

export function ContentPanel({ initialContent }: { initialContent: ContentMap }) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG)
  // Stored values per language (what the admin has typed / saved).
  const [store, setStore] = useState<Partial<Record<Lang, ContentMap>>>({ [DEFAULT_LANG]: initialContent })
  const [loadingLang, setLoadingLang] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")

  const current = store[lang] ?? {}

  // Group fields by their section for a tidy layout.
  const groups = CONTENT_FIELDS.reduce<Record<string, typeof CONTENT_FIELDS>>((acc, f) => {
    ;(acc[f.group] ||= []).push(f)
    return acc
  }, {})

  async function switchLang(next: Lang) {
    setStatus("idle")
    if (next === lang) return
    if (store[next]) {
      setLang(next)
      return
    }
    setLoadingLang(true)
    try {
      const data = await getContentForLang(next)
      setStore((s) => ({ ...s, [next]: data }))
      setLang(next)
    } catch {
      setStatus("error")
    } finally {
      setLoadingLang(false)
    }
  }

  function set(key: string, val: string) {
    setStore((s) => ({ ...s, [lang]: { ...(s[lang] ?? {}), [key]: val } }))
    setStatus("idle")
  }

  async function save() {
    setSaving(true)
    setStatus("idle")
    try {
      const res = await updateContent(lang, current)
      setStatus(res.ok ? "saved" : "error")
    } catch {
      setStatus("error")
    } finally {
      setSaving(false)
    }
  }

  function clearField(key: string) {
    set(key, "")
  }

  const isEs = lang === DEFAULT_LANG

  return (
    <div>
      <div className="admin-panel-head">
        <div>
          <h2>Textos del sitio</h2>
          <p>Edita los textos por idioma. Los cambios se reflejan en el sitio público al guardar.</p>
        </div>
        <div className="admin-content-save">
          {status === "saved" ? <span className="admin-save-ok">Cambios guardados</span> : null}
          {status === "error" ? <span className="admin-save-err">Error al guardar</span> : null}
          <button className="admin-btn admin-btn-primary" onClick={save} disabled={saving || loadingLang}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="admin-lang-tabs" role="tablist" aria-label="Idioma del contenido">
        {LANGS.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={l === lang}
            className={`admin-lang-tab${l === lang ? " active" : ""}`}
            onClick={() => switchLang(l)}
            disabled={loadingLang}
          >
            <span className={`fi fi-${LANG_META[l].flag}`} aria-hidden="true" />
            {LANG_META[l].label}
          </button>
        ))}
      </div>

      {!isEs ? (
        <p className="admin-lang-note">
          Deja un campo vacío para que el sitio use automáticamente el texto en español.
        </p>
      ) : null}

      {loadingLang ? (
        <p className="admin-lang-loading">Cargando idioma…</p>
      ) : (
        <div className="admin-content-groups">
          {Object.entries(groups).map(([group, fields]) => (
            <section className="admin-content-group" key={group}>
              <h3>{group}</h3>
              {fields.map((f) => {
                const esValue = (store[DEFAULT_LANG] ?? {})[f.key] || f.default
                const placeholder = isEs ? f.default : esValue
                return (
                  <div className="admin-field admin-content-field" key={f.key}>
                    <div className="admin-content-field-top">
                      <span>{f.label}</span>
                      {(current[f.key] ?? "") !== "" ? (
                        <button type="button" className="admin-link-btn" onClick={() => clearField(f.key)}>
                          Limpiar
                        </button>
                      ) : null}
                    </div>
                    {f.type === "textarea" ? (
                      <textarea
                        value={current[f.key] ?? ""}
                        rows={3}
                        placeholder={placeholder}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={current[f.key] ?? ""}
                        placeholder={placeholder}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )}
                    {!isEs ? <small className="admin-field-hint">Español: {esValue}</small> : null}
                    {isEs && f.hint ? <small className="admin-field-hint">{f.hint}</small> : null}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
