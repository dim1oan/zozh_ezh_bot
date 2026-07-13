"use client"

import { Loader2, Star } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"
import { PayButtons } from "@/components/pay-buttons"
import { ACTIVITY_LEVELS, GOALS } from "@/lib/nutrition"
import { apiFetch, haptic, swrFetcher } from "@/lib/telegram-client"
import type { Profile } from "@/lib/types"

interface SubscriptionInfo {
  active: boolean
  trial: boolean
  until: string | null
}

function SubscriptionCard() {
  const { data, mutate } = useSWR<{ subscription?: SubscriptionInfo }>("/api/profile", swrFetcher)
  const [showPay, setShowPay] = useState(false)
  const sub = data?.subscription
  if (!sub) return null

  const untilText = sub.until
    ? new Date(sub.until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Star className="size-4 text-primary" />
          {"Подписка"}
        </h2>
        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
            sub.active ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
          }`}
        >
          {sub.active ? (sub.trial ? "Пробный период" : "Активна") : "Не активна"}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {sub.active
          ? sub.trial
            ? `Бесплатный период до ${untilText}. Дальше — 100 ₽/мес.`
            : `Оплачена до ${untilText}.`
          : "Подписка закончилась. Продлите, чтобы пользоваться всеми функциями."}
      </p>

      {showPay ? (
        <PayButtons onPaid={() => mutate()} />
      ) : (
        <button
          type="button"
          onClick={() => setShowPay(true)}
          className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {sub.active ? "Продлить — 100 ₽/мес" : "Оформить — 100 ₽/мес"}
        </button>
      )}
    </section>
  )
}

interface ProfileScreenProps {
  profile: Profile
  onboarding?: boolean
  onSaved: (profile: Profile) => void
}

export function ProfileScreen({ profile, onboarding = false, onSaved }: ProfileScreenProps) {
  const [gender, setGender] = useState(profile.gender || "m")
  const [age, setAge] = useState(profile.age ? String(profile.age) : "")
  const [height, setHeight] = useState(profile.height ? String(profile.height) : "")
  const [weight, setWeight] = useState(profile.weight ? String(profile.weight) : "")
  const [activity, setActivity] = useState(profile.activity || 1.375)
  const [goal, setGoal] = useState(profile.goal || "keep")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = Number(age) > 0 && Number(height) > 0 && Number(weight) > 0

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          gender,
          age: Number(age),
          height: Number(height),
          weight: Number(weight),
          activity,
          goal,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      const data = await res.json()
      haptic("success")
      onSaved(data.profile)
    } catch {
      setError("Не удалось сохранить. Попробуй ещё раз.")
      haptic("error")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border border-input bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <div className="flex flex-col gap-4 pb-24">
      {!onboarding && <SubscriptionCard />}

      {onboarding && (
        <section className="rounded-2xl bg-card p-4">
          <h2 className="text-base font-semibold">Привет! Давай знакомиться</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Укажи свои параметры — я рассчитаю дневную норму калорий и БЖУ по формуле Миффлина-Сан Жеора.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-2xl bg-card p-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Пол</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Пол">
            {[
              { value: "m", label: "Мужской" },
              { value: "f", label: "Женский" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={gender === opt.value}
                onClick={() => setGender(opt.value)}
                className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  gender === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Возраст</span>
            <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Рост, см</span>
            <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Вес, кг</span>
            <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" className={inputClass} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Активность</span>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Уровень активности">
            {ACTIVITY_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                role="radio"
                aria-checked={activity === lvl.value}
                onClick={() => setActivity(lvl.value)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  activity === lvl.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Цель</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Цель">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                role="radio"
                aria-checked={goal === g.value}
                onClick={() => setGoal(g.value)}
                className={`rounded-xl py-2.5 text-xs font-medium transition-colors ${
                  goal === g.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !valid}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Сохраняю..." : onboarding ? "Рассчитать норму" : "Сохранить"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {!onboarding && profile.calorieTarget && (
        <section className="rounded-2xl bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Твоя дневная цель</h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Ккал", value: Math.round(profile.calorieTarget) },
              { label: "Белки", value: Math.round(profile.proteinTarget || 0) },
              { label: "Жиры", value: Math.round(profile.fatTarget || 0) },
              { label: "Углеводы", value: Math.round(profile.carbTarget || 0) },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
                <span className="text-lg font-semibold tabular-nums">{stat.value}</span>
                <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
