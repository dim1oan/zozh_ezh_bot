"use client"

import { BarChart3, CalendarDays, ChefHat, Dumbbell, Moon, Plus, User } from "lucide-react"

export type Tab = "today" | "add" | "plan" | "workouts" | "sleep" | "stats" | "profile"

const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "plan", label: "Рацион", icon: ChefHat },
  { id: "add", label: "Добавить", icon: Plus },
  { id: "workouts", label: "Трени", icon: Dumbbell },
  { id: "sleep", label: "Сон", icon: Moon },
  { id: "stats", label: "Стата", icon: BarChart3 },
  { id: "profile", label: "Профиль", icon: User },
]

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          const isAdd = id === "add"
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isAdd ? (
                <span
                  className={`flex size-9 -mt-3 items-center justify-center rounded-full shadow-lg ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/90 text-primary-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
              ) : (
                <Icon className="size-5" />
              )}
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
