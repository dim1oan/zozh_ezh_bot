import { and, desc, eq, gte, lt, sum } from "drizzle-orm"
import { db } from "@/lib/db"
import { waterLog } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

export const maxDuration = 30

function todayRange(tzOffset: number): { start: Date; end: Date } {
  const nowLocal = new Date(Date.now() - tzOffset * 60_000)
  const start = new Date(
    Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) + tzOffset * 60_000,
  )
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

/** GET /api/water?tz=-180 — сумма воды за сегодня (мл) */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const tzOffset = Number(url.searchParams.get("tz") || 0)
  const { start, end } = todayRange(tzOffset)

  const [row] = await db
    .select({ total: sum(waterLog.amountMl) })
    .from(waterLog)
    .where(and(eq(waterLog.userId, auth.user.id), gte(waterLog.drunkAt, start), lt(waterLog.drunkAt, end)))

  return Response.json({ totalMl: Number(row?.total) || 0 })
}

/** POST /api/water — добавить воду { amountMl: number } */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const amountMl = Number(body?.amountMl)
  if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 5000) {
    return Response.json({ error: "amountMl must be between 1 and 5000" }, { status: 400 })
  }

  await db.insert(waterLog).values({
    userId: auth.user.id,
    amountMl,
    drunkAt: new Date(),
  })

  return Response.json({ ok: true })
}

/** DELETE /api/water — удалить последнюю запись воды */
export async function DELETE(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const [last] = await db
    .select({ id: waterLog.id })
    .from(waterLog)
    .where(eq(waterLog.userId, auth.user.id))
    .orderBy(desc(waterLog.drunkAt))
    .limit(1)

  if (!last) return Response.json({ ok: false })

  await db.delete(waterLog).where(and(eq(waterLog.id, last.id), eq(waterLog.userId, auth.user.id)))
  return Response.json({ ok: true })
}
