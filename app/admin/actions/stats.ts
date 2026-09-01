"use server"

import { db } from "@/lib/db"
import { siteVisit } from "@/lib/db/schema"
import { requirePermission } from "@/lib/admin-auth"
import { gte, sql, desc } from "drizzle-orm"

export type CountRow = { label: string; count: number }
export type DayRow = { day: string; count: number }

export type VisitStats = {
  total: number
  last7: number
  last30: number
  today: number
  byCountry: CountRow[]
  bySource: CountRow[]
  perDay: DayRow[] // last 14 days, oldest → newest
  topSource: string | null
  countriesCount: number
}

function startOfDaysAgo(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

/**
 * Aggregates website-visit analytics for the "Estadísticas" panel. Visible to
 * admins and to editors granted the "stats" permission.
 */
export async function getVisitStats(): Promise<VisitStats> {
  await requirePermission("stats")

  const since30 = startOfDaysAgo(30)
  const since7 = startOfDaysAgo(7)
  const since14 = startOfDaysAgo(13) // 14 buckets including today
  const startToday = startOfDaysAgo(0)

  const [totalRow, last7Row, last30Row, todayRow, byCountry, bySource, perDayRaw] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(siteVisit),
    db.select({ n: sql<number>`count(*)::int` }).from(siteVisit).where(gte(siteVisit.createdAt, since7)),
    db.select({ n: sql<number>`count(*)::int` }).from(siteVisit).where(gte(siteVisit.createdAt, since30)),
    db.select({ n: sql<number>`count(*)::int` }).from(siteVisit).where(gte(siteVisit.createdAt, startToday)),
    db
      .select({ label: siteVisit.country, count: sql<number>`count(*)::int` })
      .from(siteVisit)
      .groupBy(siteVisit.country)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ label: siteVisit.source, count: sql<number>`count(*)::int` })
      .from(siteVisit)
      .groupBy(siteVisit.source)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(siteVisit)
      .where(gte(siteVisit.createdAt, since14))
      .groupBy(sql`date_trunc('day', "createdAt")`)
      .orderBy(sql`date_trunc('day', "createdAt")`),
  ])

  // Build a continuous 14-day series so days with zero visits still show.
  const perDayMap = new Map(perDayRaw.map((r) => [r.day, r.count]))
  const perDay: DayRow[] = []
  for (let i = 13; i >= 0; i--) {
    const d = startOfDaysAgo(i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    perDay.push({ day: key, count: perDayMap.get(key) ?? 0 })
  }

  const countriesCount = byCountry.filter((c) => c.label).length

  return {
    total: totalRow[0]?.n ?? 0,
    last7: last7Row[0]?.n ?? 0,
    last30: last30Row[0]?.n ?? 0,
    today: todayRow[0]?.n ?? 0,
    byCountry: byCountry.map((c) => ({ label: c.label || "Desconocido", count: c.count })),
    bySource: bySource.map((s) => ({ label: s.label || "Directo", count: s.count })),
    perDay,
    topSource: bySource[0]?.label || null,
    countriesCount,
  }
}
