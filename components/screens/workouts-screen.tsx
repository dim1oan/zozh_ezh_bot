"use client"

import { ChevronLeft, ChevronRight, ClipboardList, Clock, Dumbbell, History, Plus, Timer, Trash2, X } from "lucide-react"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { EXERCISES, WORKOUT_CATEGORIES, type WorkoutCategory } from "@/lib/exercises"
import { WORKOUT_PROGRAMS } from "@/lib/workout-programs"
import { apiFetch, swrFetcher } from "@/lib/telegram-client"

interface WorkoutRow {
  id: number
  category: string
  exercise: string
  note: string | null
  weightKg: number | null
  time: string | null
}

interface DayCount {
  date: string
  count: number
  durationMin: number | null
}

interface HistoryEntry {
  id: number
  weightKg: number | null
  note: string | null
  date: string | null
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const today = toDateStr(new Date())
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
  if (dateStr === today) return "Сегодня"
  if (dateStr === yesterday) return "Вчера"
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function WorkoutsScreen() {
  const tz = new Date().getTimezoneOffset()
  const [date, setDate] = useState(() => toDateStr(new Date()))
  const [category, setCategory] = useState<WorkoutCategory | null>(null)
  const [customText, setCustomText] = useState("")
  const [saving, setSaving] = useState(false)

  // Выбранное упражнение из каталога (для ввода веса перед добавлением)
  const [pendingExercise, setPendingExercise] = useState<string | null>(null)
  const [weightInput, setWeightInput] = useState("")
  const [timeInput, setTimeInput] = useState(nowTime)

  // Упражнение, чья история весов открыта
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  // Раскрытая готовая программа
  const [openProgram, setOpenProgram] = useState<string | null>(null)

  const { data, mutate } = useSWR<{ workouts: WorkoutRow[]; durationMin: number | null }>(
    `/api/workouts?date=${date}&tz=${tz}`,
    swrFetcher,
  )
  const rows = data?.workouts ?? []

  // Длительность тренировки за день
  const [durationInput, setDurationInput] = useState("")
  const [durationSaving, setDurationSaving] = useState(false)
  const savedDuration = data?.durationMin ?? null

  const strip = useSWR<{ days: DayCount[] }>(`/api/workouts?days=14&tz=${tz}`, swrFetcher)
  const stripDays = strip.data?.days ?? []
  const maxDuration = Math.max(30, ...stripDays.map((d) => d.durationMin ?? 0))

  const historyQuery = useSWR<{ history: HistoryEntry[] }>(
    historyFor ? `/api/workouts?history=${encodeURIComponent(historyFor)}&tz=${tz}` : null,
    swrFetcher,
  )

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutRow[]>()
    for (const w of rows) {
      const list = map.get(w.category) ?? []
      list.push(w)
      map.set(w.category, list)
    }
    return [...map.entries()]
  }, [rows])

  function shiftDay(delta: number) {
    const [y, m, d] = date.split("-").map(Number)
    setDate(toDateStr(new Date(y, m - 1, d + delta)))
  }

  async function addWorkout(cat: string, exercise: string, weight?: number | null) {
    setSaving(true)
    try {
      await apiFetch("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          category: cat,
          exercise,
          weight: weight ?? undefined,
          time: timeInput,
          date,
          tz,
        }),
      })
      await Promise.all([mutate(), strip.mutate()])
      setCustomText("")
      setPendingExercise(null)
      setWeightInput("")
    } finally {
      setSaving(false)
    }
  }

  async function removeWorkout(id: number) {
    await apiFetch(`/api/workouts?id=${id}`, { method: "DELETE" })
    await Promise.all([mutate(), strip.mutate()])
  }

  async function addProgram(items: { category: string; exercise: string }[]) {
    setSaving(true)
    try {
      await apiFetch("/api/workouts", {
        method: "POST",
        body: JSON.stringify({ items, time: timeInput, date, tz }),
      })
      await Promise.all([mutate(), strip.mutate()])
      setOpenProgram(null)
    } finally {
      setSaving(false)
    }
  }

  async function saveDuration() {
    const mins = Number.parseInt(durationInput, 10)
    if (!Number.isFinite(mins) || mins <= 0) return
    setDurationSaving(true)
    try {
      await apiFetch("/api/workouts", {
        method: "PUT",
        body: JSON.stringify({ date, duration: mins }),
      })
      await mutate()
      setDurationInput("")
    } finally {
      setDurationSaving(false)
    }
  }

  const isToday = date === toDateStr(new Date())
  const historyEntries = historyQuery.data?.history?.filter((h) => h.date !== date || h.weightKg != null) ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Переключатель дня: стрелки + мини-диаграмма за 14 дней */}
      <section className="rounded-2xl bg-card p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground"
            aria-label="Предыдущий день"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold">{formatDay(date)}</span>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            disabled={isToday}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-30"
            aria-label="Следующий день"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Диаграмма: тап по столбику — переход на день */}
        <div className="mt-2 flex items-end justify-between gap-1" role="tablist" aria-label="Выбор дня по диаграмме">
          {stripDays.map((d) => {
            const selected = d.date === date
            const dayNum = Number(d.date.slice(8, 10))
            // Высота столбика пропорциональна длительности тренировки;
            // если длительность не указана, но упражнения есть — маленький столбик
            const dur = d.durationMin ?? 0
            const height = dur > 0 ? 10 + (dur / maxDuration) * 30 : d.count > 0 ? 10 : 6
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setDate(d.date)}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                aria-label={`${d.date}, упражнений: ${d.count}${dur > 0 ? `, длительность: ${dur} мин` : ""}`}
              >
                <span
                  className={`w-full max-w-4 rounded-sm transition-colors ${
                    selected ? "bg-primary" : dur > 0 || d.count > 0 ? "bg-chart-3" : "bg-secondary"
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className={`text-[9px] tabular-nums ${selected ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Записанные тренировки */}
      {grouped.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 text-center">
          <Dumbbell className="size-8 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {"Тренировок нет. Выбери группу мышц ниже или запиши упражнение текстом."}
          </p>
        </section>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} className="rounded-2xl bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-primary">{cat}</h2>
            <ul className="flex flex-col gap-1">
              {items.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => setHistoryFor(historyFor === w.exercise ? null : w.exercise)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-label={`История весов: ${w.exercise}`}
                  >
                    <span className="truncate text-sm leading-relaxed">{w.exercise}</span>
                    <History className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                  <span className="flex shrink-0 items-center gap-2">
                    {w.weightKg != null && (
                      <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {w.weightKg} кг
                      </span>
                    )}
                    {w.time && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">{w.time}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeWorkout(w.id)}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground"
                      aria-label={`Удалить ${w.exercise}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* История весов выбранного упражнения */}
      {historyFor && (
        <section className="rounded-2xl border border-primary/30 bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold">
              {"История: "}
              <span className="text-primary">{historyFor}</span>
            </h2>
            <button
              type="button"
              onClick={() => setHistoryFor(null)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
              aria-label="Закрыть историю"
            >
              <X className="size-4" />
            </button>
          </div>
          {historyQuery.isLoading ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Загрузка...</p>
          ) : historyEntries.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Прошлых записей пока нет</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {historyEntries.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span className="text-muted-foreground">{h.date ? formatDay(h.date) : "—"}</span>
                  <span className="font-semibold tabular-nums">
                    {h.weightKg != null ? `${h.weightKg} кг` : "без веса"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Время и длительность тренировки */}
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="workout-time" className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-primary" />
            {"Время тренировки"}
          </label>
          <input
            id="workout-time"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="rounded-xl border border-input bg-secondary px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="workout-duration" className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="size-4 text-primary" />
            {"Длительность"}
          </label>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              saveDuration()
            }}
          >
            {savedDuration != null && !durationInput && (
              <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                {savedDuration} мин
              </span>
            )}
            <input
              id="workout-duration"
              type="text"
              inputMode="numeric"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value.replace(/\D/g, ""))}
              placeholder={savedDuration != null ? "изменить" : "мин"}
              className="w-20 rounded-xl border border-input bg-secondary px-3 py-2 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
              aria-label="Длительность тренировки в минутах"
            />
            <button
              type="submit"
              disabled={durationSaving || !durationInput.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Сохранить длительность"
            >
              <Plus className="size-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Ввод текстом */}
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Записать текстом</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (customText.trim()) addWorkout(category ?? "Другое", customText.trim())
          }}
        >
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Напр.: жим лёжа 4х10 60кг"
            className="min-w-0 flex-1 rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={saving || !customText.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Добавить упражнение"
          >
            <Plus className="size-5" />
          </button>
        </form>
        {category && (
          <p className="mt-2 text-xs text-muted-foreground">
            {"Запишется в группу: "}
            <span className="text-primary">{category}</span>
          </p>
        )}
      </section>

      {/* Готовые программы */}
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-primary" />
          {"Готовые программы"}
        </h2>
        <ul className="flex flex-col gap-1.5">
          {WORKOUT_PROGRAMS.map((p) => {
            const isOpen = openProgram === p.name
            return (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => setOpenProgram(isOpen ? null : p.name)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-relaxed">{p.name}</span>
                    <span
                      className={`block truncate text-xs ${isOpen ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {p.description}
                    </span>
                  </span>
                  <ChevronRight className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen && (
                  <div className="mt-1.5 rounded-xl border border-primary/30 bg-secondary/50 p-3">
                    <ul className="mb-3 flex flex-col gap-1">
                      {p.items.map((it) => (
                        <li key={it.exercise} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate leading-relaxed">{it.exercise}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{it.category}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => addProgram(p.items)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      <Plus className="size-4" />
                      {`Добавить всю программу (${p.items.length})`}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* Каталог групп и упражнений */}
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Группы мышц</h2>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(category === cat ? null : cat)
                setPendingExercise(null)
              }}
              className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                category === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {category && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">{category}</h3>
              <button
                type="button"
                onClick={() => {
                  setCategory(null)
                  setPendingExercise(null)
                }}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground"
                aria-label="Закрыть список упражнений"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {EXERCISES[category].map((ex) => {
                const isPending = pendingExercise === ex.name
                return (
                  <li key={ex.name}>
                    {isPending ? (
                      /* Форма ввода веса перед добавлением */
                      <form
                        className="flex items-center gap-2 rounded-xl border border-primary/40 bg-secondary px-3 py-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const w = Number.parseFloat(weightInput.replace(",", "."))
                          addWorkout(category, ex.name, Number.isFinite(w) && w > 0 ? w : null)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">{ex.name}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoFocus
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          placeholder="кг"
                          className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                          aria-label={`Вес для ${ex.name}, кг`}
                        />
                        <button
                          type="submit"
                          disabled={saving}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                          aria-label={`Добавить ${ex.name}`}
                        >
                          <Plus className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingExercise(null)
                            setWeightInput("")
                          }}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                          aria-label="Отменить"
                        >
                          <X className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          if (ex.weighted) {
                            setPendingExercise(ex.name)
                            setWeightInput("")
                          } else {
                            addWorkout(category, ex.name)
                          }
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5 text-left text-sm disabled:opacity-40"
                      >
                        <span className="leading-relaxed">{ex.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {ex.weighted && (
                            <span className="text-[10px] font-medium text-muted-foreground">кг</span>
                          )}
                          <Plus className="size-4 text-primary" />
                        </span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
