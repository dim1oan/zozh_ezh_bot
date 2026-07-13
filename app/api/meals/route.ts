import { and, asc, eq, gte, inArray, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { mealItems, meals } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

export const maxDuration = 30

/** GET /api/meals?date=YYYY-MM-DD — приёмы пищи за день с позициями */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const dateStr = url.searchParams.get("date")
  const tzOffset = Number(url.searchParams.get("tz") || 0) // минуты, как getTimezoneOffset()

  // Начало дня в локальной зоне пользователя
  const base = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date()
  let start: Date
  if (dateStr) {
    start = new Date(base.getTime() + tzOffset * 60_000)
  } else {
    const nowLocal = new Date(Date.now() - tzOffset * 60_000)
    start = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) + tzOffset * 60_000,
    )
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, auth.user.id), gte(meals.eatenAt, start), lt(meals.eatenAt, end)))
    .orderBy(asc(meals.eatenAt))

  const ids = rows.map((m) => m.id)
  const items = ids.length > 0 ? await db.select().from(mealItems).where(inArray(mealItems.mealId, ids)) : []

  return Response.json({
    meals: rows.map((m) => ({
      ...m,
      items: items.filter((i) => i.mealId === m.id),
    })),
  })
}

/** POST /api/meals — сохранить приём пищи */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { mealType, rawText, items, totals } = body
  if (!mealType || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "mealType and items required" }, { status: 400 })
  }

  const [meal] = await db
    .insert(meals)
    .values({
      userId: auth.user.id,
      mealType: String(mealType),
      rawText: String(rawText || ""),
      eatenAt: new Date(),
      totalKcal: Number(totals?.kcal) || 0,
      totalProtein: Number(totals?.protein) || 0,
      totalFat: Number(totals?.fat) || 0,
      totalCarbs: Number(totals?.carbs) || 0,
    })
    .returning()

  await db.insert(mealItems).values(
    items.map((it: Record<string, unknown>) => ({
      mealId: meal.id,
      name: String(it.name ?? "?"),
      grams: Number(it.grams) || 0,
      kcal: Number(it.kcal) || 0,
      protein: Number(it.protein) || 0,
      fat: Number(it.fat) || 0,
      carbs: Number(it.carbs) || 0,
    })),
  )

  return Response.json({ id: meal.id })
}
