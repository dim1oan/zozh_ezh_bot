"use client"

import { Bell, Info, Moon, Send, UtensilsCrossed } from "lucide-react"
import { useState } from "react"
import { apiFetch, haptic } from "@/lib/telegram-client"
import type { Profile } from "@/lib/types"

const NOTIFY_INTERVALS = [
  { hours: 3, label: "3 ч" },
  { hours: 6, label: "6 ч" },
  { hours: 12, label: "12 ч" },
  { hours: 24, label: "24 ч" },
]

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
        className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-background transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
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
  return <h2 className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
}

interface SettingsScreenProps {
  profile: Profile
}

export function SettingsScreen({ profile }: SettingsScreenProps) {
  const [enabled, setEnabled] = useState(profile.notifyEnabled ?? true)
  const [hours, setHours] = useState(profile.notifyHours ?? 6)
  const [saving, setSaving] = useState(false)

  async function update(next: { notifyEnabled?: boolean; notifyHours?: number }) {
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

  return (
    <div className="flex flex-col pb-24 -mx-1">
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
