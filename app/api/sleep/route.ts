import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { sleepLog } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

const TIME_RE = /^\d{2}:\d{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Длительность сна в минутах: если конец "раньше" начала — сон через полночь */
function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * GET /api/sleep?date=YYYY-MM-DD — запись за дату (дата пробуждения) + полоса за 14 дней
 */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get("date") || ""
  if (!DATE_RE.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  const firstDay = shiftDate(date, -13)
  const rows = await db
    .select()
    .from(sleepLog)
    .where(
      and(eq(sleepLog.userId, auth.user.id), gte(sleepLog.sleepDate, firstDay), lte(sleepLog.sleepDate, date)),
    )

  const byDate: Record<string, (typeof rows)[number]> = {}
  for (const r of rows) byDate[r.sleepDate] = r

  const days: { date: string; durationMin: number | null; hasDream: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const key = shiftDate(date, -i)
    const row = byDate[key]
    days.push({
      date: key,
      durationMin: row?.durationMin ?? null,
      hasDream: Boolean(row?.dream),
    })
  }

  return Response.json({ entry: byDate[date] ?? null, days })
}

/**
 * POST /api/sleep — сохранить сон { date, start, end, dream? } (upsert по дате)
 */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const date = String(body?.date || "")
  const start = String(body?.start || "")
  const end = String(body?.end || "")
  const dream = body?.dream != null ? String(body.dream).trim().slice(0, 2000) || null : undefined

  if (!DATE_RE.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  // Обновление только сна-текста для существующей записи
  if (!start && !end && dream !== undefined) {
    const [row] = await db
      .update(sleepLog)
      .set({ dream })
      .where(and(eq(sleepLog.userId, auth.user.id), eq(sleepLog.sleepDate, date)))
      .returning()
    if (!row) return Response.json({ error: "нет записи сна за эту дату" }, { status: 404 })
    return Response.json({ entry: row })
  }

  if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
    return Response.json({ error: "start and end must be HH:MM" }, { status: 400 })
  }

  const durationMin = calcDuration(start, end)

  const existing = await db
    .select()
    .from(sleepLog)
    .where(and(eq(sleepLog.userId, auth.user.id), eq(sleepLog.sleepDate, date)))
    .limit(1)

  if (existing.length > 0) {
    const [row] = await db
      .update(sleepLog)
      .set({ startTime: start, endTime: end, durationMin, ...(dream !== undefined ? { dream } : {}) })
      .where(and(eq(sleepLog.userId, auth.user.id), eq(sleepLog.sleepDate, date)))
      .returning()
    return Response.json({ entry: row })
  }

  const [row] = await db
    .insert(sleepLog)
    .values({
      userId: auth.user.id,
      sleepDate: date,
      startTime: start,
      endTime: end,
      durationMin,
      dream: dream ?? null,
    })
    .returning()

  return Response.json({ entry: row })
}

/** DELETE /api/sleep?date=YYYY-MM-DD — удалить запись сна */
export async function DELETE(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get("date") || ""
  if (!DATE_RE.test(date)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  await db.delete(sleepLog).where(and(eq(sleepLog.userId, auth.user.id), eq(sleepLog.sleepDate, date)))
  return Response.json({ ok: true })
}
