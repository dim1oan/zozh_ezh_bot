"use client"

import {
  BarChart3,
  Bot,
  CalendarDays,
  ChefHat,
  Dumbbell,
  Moon,
  Plus,
  Settings,
  User,
} from "lucide-react"
import { useEffect, useRef } from "react"

export type Tab =
  | "today"
  | "add"
  | "plan"
  | "workouts"
  | "sleep"
  | "trainer"
  | "stats"
  | "profile"
  | "settings"

// Вкладки в ленте (без «Добавить» — он всегда по центру)
const SCROLL_TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "plan", label: "Рацион", icon: ChefHat },
  { id: "workouts", label: "Трени", icon: Dumbbell },
  { id: "sleep", label: "Сон", icon: Moon },
  { id: "trainer", label: "Тренер", icon: Bot },
  { id: "stats", label: "Стата", icon: BarChart3 },
  { id: "profile", label: "Профиль", icon: User },
  { id: "settings", label: "Настройки", icon: Settings },
]

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Прокручиваем активную вкладку к видимой зоне
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const el = container.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`)
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" })
  }, [active])

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Основная навигация"
    >
      <div className="relative mx-auto max-w-md">
        {/* Центральная кнопка Добавить */}
        <button
          type="button"
          onClick={() => onChange("add")}
          aria-current={active === "add" ? "page" : undefined}
          aria-label="Добавить еду"
          className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
        >
          <span
            className={`flex size-12 items-center justify-center rounded-full shadow-lg ring-4 ring-card transition-transform ${
              active === "add" ? "scale-105 bg-primary" : "bg-primary"
            } text-primary-foreground`}
          >
            <Plus className="size-6" />
          </span>
        </button>

        {/* Листаемая лента вкладок: видно по одной слева и справа от плюса */}
        <div
          ref={scrollRef}
          role="tablist"
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SCROLL_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                data-tab={id}
                aria-selected={isActive}
                onClick={() => onChange(id)}
                className={`flex w-1/2 flex-none snap-start flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                <span className={isActive ? "font-semibold" : ""}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
