"use client"

import { useEffect } from "react"

/**
 * Fire-and-forget visit tracker for the public site. Records one visit per
 * browser session (deduped via sessionStorage) so a person refreshing or
 * navigating around does not inflate the count. Sends the referrer and any
 * utm_source so the server can classify the traffic channel; the country is
 * read server-side from Vercel geo headers. Renders nothing.
 */
export function SiteVisitTracker() {
  useEffect(() => {
    const KEY = "camvex-visit-tracked"
    try {
      if (sessionStorage.getItem(KEY)) return
      sessionStorage.setItem(KEY, "1")
    } catch {
      // sessionStorage may be unavailable (private mode); still track once.
    }

    const utmSource = new URLSearchParams(window.location.search).get("utm_source") || ""

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || "",
        utmSource,
      }),
    }).catch(() => {
      // Ignore network/tracking errors — never affect the visitor experience.
    })
  }, [])

  return null
}
