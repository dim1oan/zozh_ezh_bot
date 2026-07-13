"use client"

import { Bell, Droplets, Info, Moon, Palette, Send, Sun, UtensilsCrossed } from "lucide-react"
import { useEffect, useState } from "react"
import { apiFetch, haptic } from "@/lib/telegram-client"
import type { Profile } from "@/lib/types"

const NOTIFY_INTERVALS = [
  { hours: 3, label: "3 ч" },
  { hours: 6, label: "6 ч" },
  { hours: 12, label: "12 ч" },
  { hours: 24, label: "24 ч" },
]

type Theme = "light" | "dark" | "system"

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

function Toggle({
  checked,
  disabled,
  onToggle,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary"}`}
      aria-label={label}
    >
      <span
        className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-card transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: React.ReactNode; title?: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-lg bg-secondary p-0.5" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Row({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Bell
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-relaxed">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

interface SettingsScreenProps {
  profile: Profile
}

export function SettingsScreen({ profile }: SettingsScreenProps) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [enabled, setEnabled] = useState(profile.notifyEnabled ?? true)
  const [hours, setHours] = useState(profile.notifyHours ?? 6)
  const [waterMode, setWaterMode] = useState<"auto" | "manual">(profile.waterGoalMl ? "manual" : "auto")
  const [waterMl, setWaterMl] = useState(profile.waterGoalMl ?? 2000)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored)
  }, [])

  function changeTheme(next: Theme) {
    setTheme(next)
    localStorage.setItem("theme", next)
    applyTheme(next)
    haptic("light")
  }

  async function update(next: { notifyEnabled?: boolean; notifyHours?: number; waterGoalMl?: number | null }) {
    setSaving(true)
    try {
      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(next),
      })
      if (res.ok) haptic("success")
    } finally {
      setSaving(false)
    }
  }

  const autoWater = profile.weight ? Math.round(profile.weight * 30) : 2000

  return (
    <div className="flex flex-col pb-24 -mx-1">
      <SectionTitle>Внешний вид</SectionTitle>
      <section className="overflow-hidden rounded-2xl bg-card">
        <Row icon={Palette} title="Тема" subtitle={theme === "system" ? "Как в системе" : theme === "dark" ? "Тёмная" : "Светлая"}>
          <Segmented
            value={theme}
            label="Тема оформления"
            onChange={changeTheme}
            options={[
              { value: "light", label: <Sun className="size-4" />, title: "Светлая" },
              { value: "dark", label: <Moon className="size-4" />, title: "Тёмная" },
              { value: "system", label: "Системная" },
            ]}
          />
        </Row>
      </section>

      <SectionTitle>Напоминания</SectionTitle>
      <section className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        <Row
          icon={Bell}
          title="Напоминания включены"
          subtitle={enabled ? "Бот напомнит, если вы долго не заходили" : "Выключены"}
        >
          <Toggle
            checked={enabled}
            disabled={saving}
            label="Включить напоминания"
            onToggle={() => {
              const next = !enabled
              setEnabled(next)
              update({ notifyEnabled: next })
            }}
          />
        </Row>

        {enabled && (
          <Row icon={UtensilsCrossed} title="Напоминать после" subtitle="Время без записей еды">
            <div className="flex gap-1" role="radiogroup" aria-label="Интервал напоминаний">
              {NOTIFY_INTERVALS.map((it) => (
                <button
                  key={it.hours}
                  type="button"
                  role="radio"
                  aria-checked={hours === it.hours}
                  disabled={saving}
                  onClick={() => {
                    setHours(it.hours)
                    update({ notifyHours: it.hours })
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    hours === it.hours
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </Row>
        )}

        <Row icon={Moon} title="Тихие часы" subtitle="В часы сна напоминания не приходят — задайте режим на вкладке Сон" />
      </section>

      <SectionTitle>Норма воды</SectionTitle>
      <section className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        <Row icon={Droplets} title="Режим расчёта" subtitle={waterMode === "auto" ? `Авто: 30 мл × вес = ${autoWater} мл` : "Задана вручную"}>
          <Segmented
            value={waterMode}
            label="Режим расчёта нормы воды"
            onChange={(mode) => {
              setWaterMode(mode)
              haptic("light")
              if (mode === "auto") {
                update({ waterGoalMl: null })
              } else {
                update({ waterGoalMl: waterMl })
              }
            }}
            options={[
              { value: "auto", label: "Авто" },
              { value: "manual", label: "Вручную" },
            ]}
          />
        </Row>

        {waterMode === "manual" && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Droplets className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-relaxed">Своя норма</p>
              <p className="text-xs text-muted-foreground">От 500 до 6000 мл</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={500}
                max={6000}
                step={50}
                value={waterMl}
                disabled={saving}
                onChange={(e) => setWaterMl(Number(e.target.value))}
                onBlur={() => {
                  const clamped = Math.min(Math.max(waterMl || 0, 500), 6000)
                  setWaterMl(clamped)
                  update({ waterGoalMl: clamped })
                }}
                className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                aria-label="Норма воды в миллилитрах"
              />
              <span className="text-xs text-muted-foreground">мл</span>
            </div>
          </div>
        )}
      </section>

      <SectionTitle>О приложении</SectionTitle>
      <section className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        <a href="https://t.me/zozh_ezh_bot" className="block">
          <Row icon={Send} title="Открыть бота" subtitle="@zozh_ezh_bot" />
        </a>
        <Row icon={Info} title="Зож-Ёж" subtitle="Дневник питания, тренировок и сна" />
      </section>
    </div>
  )
}
