import { createHmac } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

const MAX_AGE_SECONDS = 60 * 60 * 24 // initData валиден 24 часа

export interface TelegramUser {
  tgId: number
  firstName: string
  username?: string
}

/**
 * Валидация Telegram WebApp initData по HMAC-подписи с BOT_TOKEN.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string): TelegramUser | null {
  const botToken = process.env.BOT_TOKEN
  if (!botToken || !initData) return null

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  if (computed !== hash) return null

  const authDate = Number(params.get("auth_date") || 0)
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null

  try {
    const user = JSON.parse(params.get("user") || "{}")
    if (!user.id) return null
    return {
      tgId: Number(user.id),
      firstName: String(user.first_name || ""),
      username: user.username ? String(user.username) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Достаёт и валидирует initData из заголовка запроса,
 * возвращает запись пользователя из базы (создаёт при отсутствии).
 */
export async function authFromRequest(req: Request) {
  const initData = req.headers.get("x-telegram-init-data") || ""
  const tgUser = validateInitData(initData)
  if (!tgUser) return null

  let [row] = await db.select().from(users).where(eq(users.tgId, tgUser.tgId))
  if (!row) {
    const inserted = await db.insert(users).values({ tgId: tgUser.tgId }).returning()
    row = inserted[0]
  }
  return { user: row, tg: tgUser }
}
