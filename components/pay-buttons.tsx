"use client"

import { Bitcoin, Landmark, Loader2, RefreshCw, Star } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"
import { apiFetch, getTelegramWebApp, haptic, swrFetcher } from "@/lib/telegram-client"

interface PayInfo {
  providers: { stars: boolean; sbp: boolean; crypto: boolean }
  priceRub: number
  priceStars: number
}

/** Кнопки оплаты подписки: Stars (нативно), СБП и крипта (по ссылке + проверка). */
export function PayButtons({ onPaid }: { onPaid?: () => void }) {
  const { data } = useSWR<PayInfo>("/api/pay", swrFetcher)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingPaymentId, setPendingPaymentId] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const providers = data?.providers

  async function confirmStarsPaid() {
    const res = await apiFetch("/api/pay", {
      method: "PUT",
      body: JSON.stringify({ method: "stars", status: "paid" }),
    })
    if (res.ok) {
      haptic("success")
      onPaid?.()
    }
  }

  async function startPayment(method: "stars" | "sbp" | "crypto") {
    setBusy(method)
    setMessage(null)
    try {
      const res = await apiFetch("/api/pay", { method: "POST", body: JSON.stringify({ method }) })
      if (!res.ok) {
        setMessage("Способ временно недоступен. Попробуйте другой.")
        return
      }
      const payment = await res.json()
      const wa = getTelegramWebApp()

      if (method === "stars" && payment.kind === "invoice" && wa?.openInvoice) {
        // Нативное окно оплаты Stars поверх Mini App
        wa.openInvoice(payment.url, (status) => {
          if (status === "paid") void confirmStarsPaid()
          else if (status === "failed") setMessage("Оплата не прошла. Попробуйте ещё раз.")
        })
        return
      }

      // СБП / крипта — открываем ссылку, потом проверяем по кнопке
      if (payment.paymentId) setPendingPaymentId(payment.paymentId)
      if (payment.kind === "telegram_link" && wa?.openTelegramLink) wa.openTelegramLink(payment.url)
      else if (wa?.openLink) wa.openLink(payment.url)
      else window.open(payment.url, "_blank")
    } finally {
      setBusy(null)
    }
  }

  async function checkPending() {
    if (!pendingPaymentId) return
    setChecking(true)
    setMessage(null)
    try {
      const res = await apiFetch("/api/pay", {
        method: "PUT",
        body: JSON.stringify({ paymentId: pendingPaymentId }),
      })
      const result = await res.json()
      if (result.ok) {
        haptic("success")
        onPaid?.()
      } else {
        setMessage("Платёж пока не подтверждён. Подождите минуту и проверьте снова.")
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => startPayment("stars")}
        disabled={busy !== null || !providers?.stars}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy === "stars" ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
        {`Telegram Stars — ${data?.priceStars ?? 60} ⭐`}
      </button>

      <button
        type="button"
        onClick={() => startPayment("sbp")}
        disabled={busy !== null || !providers?.sbp}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
      >
        {busy === "sbp" ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
        {providers?.sbp ? `СБП — ${data?.priceRub ?? 100} ₽` : "СБП — скоро"}
      </button>

      <button
        type="button"
        onClick={() => startPayment("crypto")}
        disabled={busy !== null || !providers?.crypto}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
      >
        {busy === "crypto" ? <Loader2 className="size-4 animate-spin" /> : <Bitcoin className="size-4" />}
        {providers?.crypto ? `Криптовалюта — ~${data?.priceRub ?? 100} ₽` : "Криптовалюта — скоро"}
      </button>

      {pendingPaymentId && (
        <button
          type="button"
          onClick={checkPending}
          disabled={checking}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {"Я оплатил — проверить"}
        </button>
      )}

      {message && <p className="text-center text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
