"use client"

import { GlassWater, Undo2 } from "lucide-react"
import useSWR from "swr"
import { apiFetch, haptic, swrFetcher } from "@/lib/telegram-client"

const QUICK_AMOUNTS = [150, 250, 500]

interface WaterCardProps {
  targetMl: number
}

export function WaterCard({ targetMl }: WaterCardProps) {
  const { data, mutate } = useSWR<{ totalMl: number }>("/api/water", swrFetcher)

  const total = data?.totalMl ?? 0
  const pct = targetMl > 0 ? Math.min(total / targetMl, 1) : 0

  async function addWater(amountMl: number) {
    haptic("light")
    // Оптимистичное обновление
    mutate({ totalMl: total + amountMl }, false)
    await apiFetch("/api/water", { method: "POST", body: JSON.stringify({ amountMl }) })
    haptic("success")
    mutate()
  }

  async function undoWater() {
    haptic("light")
    await apiFetch("/api/water", { method: "DELETE" })
    mutate()
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GlassWater className="size-4 text-chart-3" aria-hidden="true" />
          <h3 className="text-sm font-medium">Вода</h3>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(total)}</span> / {Math.round(targetMl)} мл
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(total)}
        aria-valuemin={0}
        aria-valuemax={Math.round(targetMl)}
        aria-label="Прогресс воды за день"
      >
        <div className="h-full rounded-full bg-chart-3 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
      </div>

      <div className="flex items-center gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => addWater(amount)}
            className="flex-1 rounded-xl bg-secondary py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 active:scale-95"
          >
            +{amount} мл
          </button>
        ))}
        <button
          type="button"
          onClick={undoWater}
          disabled={total <= 0}
          className="rounded-xl bg-secondary p-2 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
          aria-label="Отменить последнюю запись воды"
        >
          <Undo2 className="size-4" />
        </button>
      </div>

      {pct >= 1 && <p className="text-xs text-primary">Дневная норма выполнена!</p>}
    </section>
  )
}
