import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { calcTargets } from "@/lib/nutrition"
import { authFromRequest } from "@/lib/telegram-auth"

const TRIAL_DAYS = 3

/** Статус подписки: активный платный период или триал 3 дня с регистрации */
function subscriptionOf(user: { paidUntil: Date | null; createdAt: Date | null }) {
  const now = Date.now()
  if (user.paidUntil && user.paidUntil.getTime() > now) {
    return { active: true, trial: false, until: user.paidUntil.toISOString() }
  }
  if (user.createdAt) {
    const trialEnd = user.createdAt.getTime() + TRIAL_DAYS * 86_400_000
    if (trialEnd > now) {
      return { active: true, trial: true, until: new Date(trialEnd).toISOString() }
    }
  }
  return { active: false, trial: false, until: user.paidUntil?.toISOString() ?? null }
}

/** GET /api/profile — профиль текущего пользователя */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })
  return Response.json({
    profile: auth.user,
    tg: auth.tg,
    subscription: subscriptionOf(auth.user),
  })
}

/** PUT /api/profile — обновить параметры, пересчитать цели */
export async function PUT(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const gender = body.gender === "m" ? "m" : "f"
  const age = Math.min(Math.max(Number(body.age) || 0, 10), 100)
  const height = Math.min(Math.max(Number(body.height) || 0, 100), 250)
  const weight = Math.min(Math.max(Number(body.weight) || 0, 30), 300)
  const activity = Number(body.activity) || 1.2
  const goal = ["lose", "keep", "gain"].includes(body.goal) ? body.goal : "keep"

  if (!age || !height || !weight) {
    return Response.json({ error: "age, height, weight required" }, { status: 400 })
  }

  const targets = calcTargets(gender, age, height, weight, activity, goal)

  const [updated] = await db
    .update(users)
    .set({ gender, age, height, weight, activity, goal, ...targets })
    .where(eq(users.id, auth.user.id))
    .returning()

  return Response.json({ profile: updated })
}

const NOTIFY_HOURS_ALLOWED = [3, 6, 12, 24]

/** PATCH /api/profile — настройки напоминаний { notifyEnabled?, notifyHours? } */
export async function PATCH(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const set: { notifyEnabled?: boolean; notifyHours?: number } = {}

  if (typeof body?.notifyEnabled === "boolean") set.notifyEnabled = body.notifyEnabled
  if (NOTIFY_HOURS_ALLOWED.includes(Number(body?.notifyHours))) set.notifyHours = Number(body.notifyHours)

  if (Object.keys(set).length === 0) {
    return Response.json({ error: "nothing to update" }, { status: 400 })
  }

  const [updated] = await db.update(users).set(set).where(eq(users.id, auth.user.id)).returning()
  return Response.json({ profile: updated })
}
