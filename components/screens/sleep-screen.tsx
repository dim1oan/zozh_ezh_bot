"use client"

import { BedDouble, ChevronLeft, ChevronRight, CloudMoon, Loader2, Moon, Sparkles, Sun, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { apiFetch, haptic, swrFetcher } from "@/lib/telegram-client"
import type { Profile } from "@/lib/types"

interface SleepEntry {
  id: number
  sleepDate: string
  startTime: string
  endTime: string
  durationMin: number
  dream: string | null
}

interface SleepDay {
  date: string
  durationMin: number | null
  hasDream: boolean
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

/** Норма сна по возрасту (рекомендации ВОЗ/NSF) */
function sleepNorm(age: number | null | undefined): { min: number; max: number; label: string } {
  if (age != null && age < 18) return { min: 8 * 60, max: 10 * 60, label: "8–10 часов" }
  if (age != null && age >= 65) return { min: 7 * 60, max: 8 * 60, label: "7–8 часов" }
  return { min: 7 * 60, max: 9 * 60, label: "7–9 часов" }
}

export function SleepScreen({ profile }: { profile: Profile }) {
  const [date, setDate] = useState(todayStr)
  const today = todayStr()

  const { data, mutate, isLoading } = useSWR<{ entry: SleepEntry | null; days: SleepDay[] }>(
    `/api/sleep?date=${date}`,
    swrFetcher,
  )
  const entry = data?.entry ?? null
  const days = data?.days ?? []
  const norm = sleepNorm(profile.age)

  const [start, setStart] = useState("23:30")
  const [end, setEnd] = useState("08:30")
  const [dream, setDream] = useState("")
  const [saving, setSaving] = useState(false)
  const [dreamSaving, setDreamSaving] = useState(false)
  const [showDream, setShowDream] = useState(false)

  // Подставляем сохранённые значения при смене даты/загрузке
  useEffect(() => {
    if (entry) {
      setStart(entry.startTime)
      setEnd(entry.endTime)
      setDream(entry.dream ?? "")
      setShowDream(Boolean(entry.dream))
    } else {
      setDream("")
      setShowDream(false)
    }
  }, [entry])

  const maxDuration = Math.max(norm.max, ...days.map((d) => d.durationMin ?? 0))

  async function saveSleep() {
    setSaving(true)
    try {
      await apiFetch("/api/sleep", {
        method: "POST",
        body: JSON.stringify({ date, start, end }),
      })
      haptic("success")
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  async function saveDream() {
    setDreamSaving(true)
    try {
      await apiFetch("/api/sleep", {
        method: "POST",
        body: JSON.stringify({ date, dream }),
      })
      haptic("success")
      await mutate()
    } finally {
      setDreamSaving(false)
    }
  }

  async function removeEntry() {
    await apiFetch(`/api/sleep?date=${date}`, { method: "DELETE" })
    await mutate()
  }

  const duration = entry?.durationMin ?? null
  const inNorm = duration != null && duration >= norm.min && duration <= norm.max

  return (
    <div className="flex flex-col gap-4">
      {/* Переключатель даты */}
      <section className="flex items-center justify-between rounded-2xl bg-card p-3">
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, -1))}
          className="flex size-9 items-center justify-center rounded-xl bg-secondary"
          aria-label="Предыдущий день"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold capitalize">{fmtDate(date)}</span>
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= today}
          className="flex size-9 items-center justify-center rounded-xl bg-secondary disabled:opacity-30"
          aria-label="Следующий день"
        >
          <ChevronRight className="size-4" />
        </button>
      </section>

      {/* Диаграмма за 14 дней */}
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">Сон за 14 дней</h2>
        <div className="flex items-end justify-between gap-1" role="tablist" aria-label="Выбор дня">
          {days.map((d) => {
            const selected = d.date === date
            const dur = d.durationMin ?? 0
            const height = dur > 0 ? 10 + (dur / maxDuration) * 34 : 6
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setDate(d.date)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                aria-label={`${d.date}${dur > 0 ? `, сон: ${fmtDuration(dur)}` : ", нет записи"}${d.hasDream ? ", есть сон в дневнике" : ""}`}
              >
                <span className={`size-1 rounded-full ${d.hasDream ? "bg-accent" : "bg-transparent"}`} />
                <span
                  className={`w-full max-w-4 rounded-sm transition-colors ${
                    selected ? "bg-primary" : dur > 0 ? "bg-chart-3" : "bg-secondary"
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span
                  className={`text-[9px] tabular-nums ${selected ? "font-bold text-primary" : "text-muted-foreground"}`}
                >
                  {Number(d.date.slice(8, 10))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Итог за день */}
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BedDouble className="size-4 text-primary" />
            {"Сон за ночь"}
          </h2>
          {entry && (
            <button
              type="button"
              onClick={removeEntry}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground"
              aria-label="Удалить запись сна"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : duration != null ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <p className="text-3xl font-bold tabular-nums">{fmtDuration(duration)}</p>
            <p className={`text-xs font-medium ${inNorm ? "text-primary" : "text-accent"}`}>
              {inNorm
                ? "В пределах нормы"
                : duration < norm.min
                  ? `Меньше нормы (${norm.label})`
                  : `Больше нормы (${norm.label})`}
            </p>
          </div>
        ) : (
          <p className="py-2 text-center text-sm leading-relaxed text-muted-foreground">
            {`Запишите время сна. Рекомендуемая норма: ${norm.label}.`}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sleep-start" className="flex items-center gap-2 text-sm">
            <Moon className="size-4 text-muted-foreground" />
            {"Лёг спать"}
          </label>
          <input
            id="sleep-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sleep-end" className="flex items-center gap-2 text-sm">
            <Sun className="size-4 text-muted-foreground" />
            {"Проснулся"}
          </label>
          <input
            id="sleep-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={saveSleep}
          className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {saving ? "Сохраняю..." : entry ? "Обновить время сна" : "Записать сон"}
        </button>
      </section>

      {/* Дневник снов */}
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CloudMoon className="size-4 text-primary" />
            {"Дневник снов"}
          </h2>
          {entry?.dream && (
            <span className="flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
              <Sparkles className="size-3" />
              {"записан"}
            </span>
          )}
        </div>

        {!entry ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {"Сначала запишите время сна, потом можно сохранить приснившийся сон."}
          </p>
        ) : showDream ? (
          <>
            <textarea
              value={dream}
              onChange={(e) => setDream(e.target.value)}
              rows={4}
              placeholder="Что вам приснилось?"
              className="resize-none rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              aria-label="Текст сна"
            />
            <button
              type="button"
              disabled={dreamSaving}
              onClick={saveDream}
              className="rounded-xl bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground disabled:opacity-40"
            >
              {dreamSaving ? "Сохраняю..." : "Сохранить сон"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowDream(true)}
            className="rounded-xl bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground"
          >
            {"Приснился сон? Записать"}
          </button>
        )}
      </section>
    </div>
  )
}
