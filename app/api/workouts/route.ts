import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { workoutSessions, workouts } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

export const maxDuration = 30

/** Границы суток для даты YYYY-MM-DD с учётом смещения таймзоны клиента (минуты). */
function dayRange(dateStr: string, tzOffset: number): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, d) + tzOffset * 60_000)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

/** Дата YYYY-MM-DD в таймзоне клиента для метки времени. */
function toClientDateStr(date: Date, tzOffset: number): string {
  const shifted = new Date(date.getTime() - tzOffset * 60_000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * GET /api/workouts?date=YYYY-MM-DD&tz=-180 — тренировки за день
 * GET /api/workouts?days=14&tz=-180 — количество упражнений по дням (для диаграммы)
 * GET /api/workouts?history=<exercise>&tz=-180 — последние записи упражнения (история весов)
 */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const tzOffset = Number(url.searchParams.get("tz") || 0)

  // История весов по конкретному упражнению
  const history = url.searchParams.get("history")
  if (history) {
    const rows = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, auth.user.id), eq(workouts.exercise, history)))
      .orderBy(desc(workouts.doneAt))
      .limit(20)
    return Response.json({
      history: rows.map((r) => ({
        id: r.id,
        weightKg: r.weightKg,
        note: r.note,
        date: r.doneAt ? toClientDateStr(r.doneAt, tzOffset) : null,
      })),
    })
  }

  // Сводка по дням для диаграммы-переключателя
  const daysParam = url.searchParams.get("days")
  if (daysParam) {
    const days = Math.min(Math.max(Number(daysParam) || 14, 1), 60)
    const today = toClientDateStr(new Date(), tzOffset)
    const { end } = dayRange(today, tzOffset)
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

    const rows = await db
      .select({ doneAt: workouts.doneAt })
      .from(workouts)
      .where(and(eq(workouts.userId, auth.user.id), gte(workouts.doneAt, start), lt(workouts.doneAt, end)))

    const counts: Record<string, number> = {}
    for (const r of rows) {
      if (!r.doneAt) continue
      const key = toClientDateStr(r.doneAt, tzOffset)
      counts[key] = (counts[key] || 0) + 1
    }

    // Длительности тренировок по дням (для высоты столбиков диаграммы)
    const firstDay = toClientDateStr(new Date(end.getTime() - days * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), tzOffset)
    const sessions = await db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, auth.user.id),
          gte(workoutSessions.sessionDate, firstDay),
          lte(workoutSessions.sessionDate, today),
        ),
      )
    const durations: Record<string, number> = {}
    for (const s of sessions) {
      if (s.durationMin != null) durations[s.sessionDate] = s.durationMin
    }

    const result: { date: string; count: number; durationMin: number | null }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - (i + 1) * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)
      const key = toClientDateStr(d, tzOffset)
      result.push({ date: key, count: counts[key] || 0, durationMin: durations[key] ?? null })
    }
    return Response.json({ days: result })
  }

  // Тренировки за конкретный день
  const date = url.searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }
  const { start, end } = dayRange(date, tzOffset)

  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, auth.user.id), gte(workouts.doneAt, start), lt(workouts.doneAt, end)))
    .orderBy(asc(workouts.doneAt))

  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, auth.user.id), eq(workoutSessions.sessionDate, date)))
    .limit(1)

  return Response.json({
    workouts: rows.map((r) => ({
      ...r,
      time: r.doneAt
        ? new Date(r.doneAt.getTime() - tzOffset * 60_000).toISOString().slice(11, 16)
        : null,
    })),
    durationMin: session?.durationMin ?? null,
  })
}

/** PUT /api/workouts — сохранить длительность тренировки { date, duration } */
export async function PUT(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const date = String(body?.date || "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  const durationRaw = Number(body?.duration)
  const durationMin =
    Number.isFinite(durationRaw) && durationRaw > 0 && durationRaw <= 24 * 60 ? Math.round(durationRaw) : null

  await db
    .insert(workoutSessions)
    .values({ userId: auth.user.id, sessionDate: date, durationMin })
    .onConflictDoUpdate({
      target: [workoutSessions.userId, workoutSessions.sessionDate],
      set: { durationMin },
    })

  return Response.json({ ok: true, durationMin })
}

/**
 * POST /api/workouts — добавить упражнение { category, exercise, note?, weight?, time?, date, tz }
 * или программу целиком { items: [{ category, exercise }], time?, date, tz }
 */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const date = String(body?.date || "")
  const tzOffset = Number(body?.tz || 0)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  // Время тренировки: если клиент прислал HH:MM — используем его, иначе полдень
  const { start } = dayRange(date, tzOffset)
  let minutes = 12 * 60
  const time = String(body?.time || "")
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [h, min] = time.split(":").map(Number)
    if (h >= 0 && h < 24 && min >= 0 && min < 60) minutes = h * 60 + min
  }
  const doneAt = new Date(start.getTime() + minutes * 60_000)

  // Массовое добавление (готовая программа)
  if (Array.isArray(body?.items)) {
    const items = body.items
      .map((it: { category?: unknown; exercise?: unknown }) => ({
        category: String(it?.category || "").trim(),
        exercise: String(it?.exercise || "")
          .trim()
          .slice(0, 200),
      }))
      .filter((it: { category: string; exercise: string }) => it.category && it.exercise)
      .slice(0, 30)

    if (items.length === 0) {
      return Response.json({ error: "items are empty" }, { status: 400 })
    }

    const rows = await db
      .insert(workouts)
      .values(
        items.map((it: { category: string; exercise: string }) => ({
          userId: auth.user.id,
          category: it.category,
          exercise: it.exercise,
          doneAt,
        })),
      )
      .returning()

    return Response.json({ workouts: rows })
  }

  const category = String(body?.category || "").trim()
  const exercise = String(body?.exercise || "").trim()
  const note = body?.note ? String(body.note).trim().slice(0, 500) : null

  const weightRaw = Number(body?.weight)
  const weightKg = Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw < 1000 ? weightRaw : null

  if (!category || !exercise) {
    return Response.json({ error: "category and exercise are required" }, { status: 400 })
  }

  const [row] = await db
    .insert(workouts)
    .values({
      userId: auth.user.id,
      category,
      exercise: exercise.slice(0, 200),
      note,
      weightKg,
      doneAt,
    })
    .returning()

  return Response.json({ workout: row })
}

/** DELETE /api/workouts?id=123 — удалить запись */
export async function DELETE(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = Number(url.searchParams.get("id"))
  if (!Number.isFinite(id)) return Response.json({ error: "id is required" }, { status: 400 })

  await db.delete(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, auth.user.id)))
  return Response.json({ ok: true })
}
