import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { payments, users } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

const SUB_PRICE_RUB = 100
const SUB_PRICE_STARS = 60
const SUB_DAYS = 30

const YOOKASSA_API = "https://api.yookassa.ru/v3"
const CRYPTO_PAY_API = "https://pay.crypt.bot/api"

function providersAvailable() {
  return {
    stars: Boolean(process.env.BOT_TOKEN),
    sbp: Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY),
    crypto: Boolean(process.env.CRYPTO_PAY_TOKEN),
  }
}

/** Продлить подписку на SUB_DAYS от текущего конца (или от сейчас) */
async function extendSubscription(userId: number) {
  const [row] = await db.select().from(users).where(eq(users.id, userId))
  const now = Date.now()
  const base = row?.paidUntil && row.paidUntil.getTime() > now ? row.paidUntil.getTime() : now
  const newUntil = new Date(base + SUB_DAYS * 86_400_000)
  await db.update(users).set({ paidUntil: newUntil }).where(eq(users.id, userId))
  return newUntil
}

/** GET /api/pay — доступные способы оплаты */
export async function GET(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })
  return Response.json({ providers: providersAvailable(), priceRub: SUB_PRICE_RUB, priceStars: SUB_PRICE_STARS })
}

/** POST /api/pay — создать платёж { method: "stars" | "sbp" | "crypto" } */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const method = String(body?.method || "")
  const tgId = auth.tg.tgId

  if (method === "stars") {
    // Инвойс-ссылка Telegram Stars через Bot API
    const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Подписка FitFlow",
        description: `Все функции бота и Mini App на ${SUB_DAYS} дней`,
        payload: `sub:${tgId}`,
        currency: "XTR",
        prices: [{ label: "Подписка на 30 дней", amount: SUB_PRICE_STARS }],
      }),
    })
    const data = await res.json()
    if (!data.ok) return Response.json({ error: "stars_failed" }, { status: 502 })
    return Response.json({ url: data.result, kind: "invoice" })
  }

  if (method === "sbp") {
    const shopId = process.env.YOOKASSA_SHOP_ID
    const secret = process.env.YOOKASSA_SECRET_KEY
    if (!shopId || !secret) return Response.json({ error: "sbp_unavailable" }, { status: 503 })

    const res = await fetch(`${YOOKASSA_API}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
        Authorization: `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: { value: `${SUB_PRICE_RUB}.00`, currency: "RUB" },
        confirmation: { type: "redirect", return_url: "https://t.me" },
        capture: true,
        description: `Подписка FitFlow на ${SUB_DAYS} дней (tg ${tgId})`,
        payment_method_data: { type: "sbp" },
        metadata: { tg_id: String(tgId) },
      }),
    })
    const data = await res.json()
    const url = data?.confirmation?.confirmation_url
    if (!data?.id || !url) return Response.json({ error: "sbp_failed" }, { status: 502 })

    const [payment] = await db
      .insert(payments)
      .values({ userId: tgId, provider: "sbp", externalId: data.id, amount: `${SUB_PRICE_RUB} RUB` })
      .returning()
    return Response.json({ url, kind: "link", paymentId: payment.id })
  }

  if (method === "crypto") {
    const token = process.env.CRYPTO_PAY_TOKEN
    if (!token) return Response.json({ error: "crypto_unavailable" }, { status: 503 })

    const res = await fetch(`${CRYPTO_PAY_API}/createInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Crypto-Pay-API-Token": token },
      body: JSON.stringify({
        currency_type: "fiat",
        fiat: "RUB",
        amount: String(SUB_PRICE_RUB),
        accepted_assets: "USDT,TON,BTC,ETH",
        description: `Подписка FitFlow на ${SUB_DAYS} дней (tg ${tgId})`,
        payload: String(tgId),
      }),
    })
    const data = await res.json()
    if (!data?.ok) return Response.json({ error: "crypto_failed" }, { status: 502 })
    const inv = data.result

    const [payment] = await db
      .insert(payments)
      .values({ userId: tgId, provider: "crypto", externalId: String(inv.invoice_id), amount: `${SUB_PRICE_RUB} RUB` })
      .returning()
    return Response.json({ url: inv.bot_invoice_url, kind: "telegram_link", paymentId: payment.id })
  }

  return Response.json({ error: "unknown_method" }, { status: 400 })
}

/** PUT /api/pay — проверить платёж { paymentId } либо { method: "stars", status: "paid" } */
export async function PUT(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Stars: openInvoice возвращает статус в колбэке — Telegram уже подтвердил платёж
  if (body?.method === "stars" && body?.status === "paid") {
    await db.insert(payments).values({
      userId: auth.tg.tgId,
      provider: "stars",
      externalId: null,
      amount: `${SUB_PRICE_STARS} XTR`,
      status: "succeeded",
    })
    const until = await extendSubscription(auth.user.id)
    return Response.json({ ok: true, until: until.toISOString() })
  }

  const paymentId = Number(body?.paymentId)
  if (!Number.isFinite(paymentId)) return Response.json({ error: "bad_payment_id" }, { status: 400 })

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, auth.tg.tgId)))
  if (!payment) return Response.json({ error: "not_found" }, { status: 404 })
  if (payment.status === "succeeded") return Response.json({ ok: true, already: true })

  let paid = false
  if (payment.provider === "sbp" && payment.externalId) {
    const shopId = process.env.YOOKASSA_SHOP_ID
    const secret = process.env.YOOKASSA_SECRET_KEY
    if (shopId && secret) {
      const res = await fetch(`${YOOKASSA_API}/payments/${payment.externalId}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}` },
      })
      const data = await res.json()
      paid = data?.status === "succeeded"
    }
  } else if (payment.provider === "crypto" && payment.externalId) {
    const token = process.env.CRYPTO_PAY_TOKEN
    if (token) {
      const res = await fetch(`${CRYPTO_PAY_API}/getInvoices?invoice_ids=${payment.externalId}`, {
        headers: { "Crypto-Pay-API-Token": token },
      })
      const data = await res.json()
      const items = data?.result?.items ?? []
      paid = items.length > 0 && items[0]?.status === "paid"
    }
  }

  if (!paid) return Response.json({ ok: false, pending: true })

  await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, paymentId))
  const until = await extendSubscription(auth.user.id)
  return Response.json({ ok: true, until: until.toISOString() })
}
