import { db } from "@/lib/db"
import { siteVisit } from "@/lib/db/schema"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Classifies a visit into a human-readable traffic channel. A `utm_source`
 * query param (e.g. links shared on Instagram with ?utm_source=instagram)
 * always wins; otherwise we infer from the referrer host. No referrer means
 * the person typed the address or opened a bookmark → "Directo".
 */
function classifySource(referrerHost: string, utmSource: string): string {
  const utm = utmSource.trim().toLowerCase()
  const host = referrerHost.trim().toLowerCase()

  const match = (needle: string) => utm.includes(needle) || host.includes(needle)

  if (match("instagram") || utm === "ig") return "Instagram"
  if (match("facebook") || host.startsWith("fb.") || utm === "fb") return "Facebook"
  if (match("whatsapp") || host.includes("wa.me") || host.includes("l.wa")) return "WhatsApp"
  if (match("google")) return "Google"
  if (match("bing")) return "Bing"
  if (match("duckduckgo")) return "DuckDuckGo"
  if (match("linkedin") || host.includes("lnkd.in")) return "LinkedIn"
  if (match("youtube") || host.includes("youtu.be")) return "YouTube"
  if (match("tiktok")) return "TikTok"
  if (match("twitter") || host === "t.co" || host.includes("x.com")) return "X (Twitter)"
  if (match("telegram") || host.includes("t.me")) return "Telegram"
  if (utm) return utm.charAt(0).toUpperCase() + utm.slice(1)
  if (!host) return "Directo"
  return "Otro enlace"
}

function hostFromReferrer(referrer: string): string {
  if (!referrer) return ""
  try {
    return new URL(referrer).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      path?: string
      referrer?: string
      utmSource?: string
    }

    // Country comes from Vercel's edge geo headers (present in production).
    const country =
      request.headers.get("x-vercel-ip-country") || request.headers.get("x-country") || ""

    const referrerHost = hostFromReferrer(body.referrer || "")
    const source = classifySource(referrerHost, body.utmSource || "")
    const path = (body.path || "/").slice(0, 300)

    await db.insert(siteVisit).values({
      path,
      country: country.toUpperCase().slice(0, 2),
      source,
      referrer: referrerHost.slice(0, 200),
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.log("[v0] track error:", error instanceof Error ? error.message : error)
    // Never surface tracking failures to visitors.
    return new NextResponse(null, { status: 204 })
  }
}
