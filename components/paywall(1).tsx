"use client"

import { Check, Lock } from "lucide-react"
import useSWR from "swr"
import { PayButtons } from "@/components/pay-buttons"
import { swrFetcher } from "@/lib/telegram-client"

const FEATURES = [
  "КБЖУ текстом, голосом и по фото",
  "Дневник воды и тренировок",
  "Статистика и рацион на день",
  "Mini App и бот без ограничений",
]

export function Paywall({ onPaid }: { onPaid?: () => void }) {
  const { data } = useSWR<{ priceRub: number }>("/api/pay", swrFetcher)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Lock className="size-8" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-balance">Пробный период закончился</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Оформи подписку, чтобы продолжить — всего{" "}
          <span className="font-semibold text-foreground">{data?.priceRub ?? 100} ₽/мес</span>.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2 rounded-2xl bg-card p-4 text-left">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>

      <PayButtons onPaid={onPaid} />

      <p className="text-xs text-muted-foreground">Подписка активируется сразу после оплаты на 30 дней.</p>
    </main>
  )
}
