import { and, asc, eq, gte } from "drizzle-orm"
import { db } from "@/lib/db"
import { meals } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

export const maxDuration = 30

/**
 * GET /api/reports?days=7&tz=-180
 * Возвращает агрегаты по дням за последние N дней (локальная зона пользователя).
 */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 7), 1), 90)
  const tzOffset = Number(url.searchParams.get("tz") || 0)

  // Начало периода: полночь (локальная) days-1 дней назад
  const nowLocal = new Date(Date.now() - tzOffset * 60_000)
  const todayStartLocal = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate())
  const start = new Date(todayStartLocal - (days - 1) * 24 * 60 * 60 * 1000 + tzOffset * 60_000)

  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, auth.user.id), gte(meals.eatenAt, start)))
    .orderBy(asc(meals.eatenAt))

  // Группировка по локальным дням
  const byDay = new Map<string, { kcal: number; protein: number; fat: number; carbs: number; count: number }>()
  for (let d = 0; d < days; d++) {
    const dayLocal = new Date(todayStartLocal - (days - 1 - d) * 24 * 60 * 60 * 1000)
    byDay.set(dayLocal.toISOString().slice(0, 10), { kcal: 0, protein: 0, fat: 0, carbs: 0, count: 0 })
  }
  for (const m of rows) {
    if (!m.eatenAt) continue
    const local = new Date(m.eatenAt.getTime() - tzOffset * 60_000)
    const key = local.toISOString().slice(0, 10)
    const agg = byDay.get(key)
    if (!agg) continue
    agg.kcal += m.totalKcal || 0
    agg.protein += m.totalProtein || 0
    agg.fat += m.totalFat || 0
    agg.carbs += m.totalCarbs || 0
    agg.count += 1
  }

  const daysList = [...byDay.entries()].map(([date, agg]) => ({
    date,
    kcal: Math.round(agg.kcal),
    protein: Math.round(agg.protein),
    fat: Math.round(agg.fat),
    carbs: Math.round(agg.carbs),
    count: agg.count,
  }))

  const active = daysList.filter((d) => d.count > 0)
  const avg = {
    kcal: active.length ? Math.round(active.reduce((s, d) => s + d.kcal, 0) / active.length) : 0,
    protein: active.length ? Math.round(active.reduce((s, d) => s + d.protein, 0) / active.length) : 0,
    fat: active.length ? Math.round(active.reduce((s, d) => s + d.fat, 0) / active.length) : 0,
    carbs: active.length ? Math.round(active.reduce((s, d) => s + d.carbs, 0) / active.length) : 0,
  }

  return Response.json({ days: daysList, avg })
}
