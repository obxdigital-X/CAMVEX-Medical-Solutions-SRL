"use client"

/**
 * Shown in place of a real panel when a feature is VISIBLE to the user but the
 * admin has not granted the matching permission. Communicates clearly that the
 * section exists but must be enabled by the administrator.
 */
export function FeatureLocked({ title }: { title: string }) {
  return (
    <div className="admin-locked">
      <div className="admin-locked-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15" r="1.4" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p>
        Esta función aún no ha sido habilitada por el administrador. Cuando se te
        conceda el permiso, podrás usarla desde aquí.
      </p>
      <span className="admin-locked-tag">Función no habilitada</span>
    </div>
  )
}
