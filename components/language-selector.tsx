"use client"

import { useEffect, useRef, useState } from "react"
import "flag-icons/css/flag-icons.min.css"
import { LANGUAGES, type Lang } from "@/lib/i18n"

export function LanguageSelector({
  lang,
  onChange,
  label = "Idioma",
}: {
  lang: Lang
  onChange: (l: Lang) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <div className="lang-select" ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`fi fi-${current.flag} lang-flag`} aria-hidden="true" />
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="lang-caret" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="lang-menu" role="listbox" aria-label={label}>
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                type="button"
                className={`lang-option${l.code === lang ? " active" : ""}`}
                onClick={() => {
                  onChange(l.code)
                  setOpen(false)
                }}
              >
                <span className={`fi fi-${l.flag} lang-flag`} aria-hidden="true" />
                <span>{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
