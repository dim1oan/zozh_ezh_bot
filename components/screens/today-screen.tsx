"use client"

import { Trash2 } from "lucide-react"
import useSWR from "swr"
import { MacroBar } from "@/components/macro-bar"
import { ProgressRing } from "@/components/progress-ring"
import { WaterCard } from "@/components/water-card"
import { MEAL_NAMES } from "@/lib/nutrition"
import { apiFetch, haptic, swrFetcher } from "@/lib/telegram-client"
import type { Meal, Profile } from "@/lib/types"

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"]

interface TodayScreenProps {
  profile: Profile
}

export function TodayScreen({ profile }: TodayScreenProps) {
  const { data, isLoading, mutate } = useSWR<{ meals: Meal[] }>("/api/meals", swrFetcher)

  const meals = data?.meals ?? []
  const totals = {
    kcal: meals.reduce((s, m) => s + (m.totalKcal || 0), 0),
    protein: meals.reduce((s, m) => s + (m.totalProtein || 0), 0),
    fat: meals.reduce((s, m) => s + (m.totalFat || 0), 0),
    carbs: meals.reduce((s, m) => s + (m.totalCarbs || 0), 0),
  }

  async function deleteMeal(id: number) {
    haptic("light")
    await apiFetch(`/api/meals/${id}`, { method: "DELETE" })
    haptic("success")
    mutate()
  }

  const grouped = MEAL_ORDER.map((type) => ({
    type,
    meals: meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0)

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-card p-5">
        <h2 className="sr-only">Итоги дня</h2>
        <ProgressRing value={totals.kcal} target={profile.calorieTarget || 2000} />
        <div className="flex w-full gap-4">
          <MacroBar label="Белки" value={totals.protein} target={profile.proteinTarget || 100} colorClass="bg-primary" />
          <MacroBar label="Жиры" value={totals.fat} target={profile.fatTarget || 70} colorClass="bg-accent" />
          <MacroBar label="Углеводы" value={totals.carbs} target={profile.carbTarget || 250} colorClass="bg-chart-3" />
        </div>
      </section>

      <WaterCard targetMl={profile.waterGoalMl ?? (profile.weight ? Math.round(profile.weight * 30) : 2000)} />

      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Загрузка...</p>}

      {!isLoading && meals.length === 0 && (
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground text-pretty">
            Сегодня ещё нет записей. Нажми «Добавить» и опиши, что ты съел — нейросеть посчитает КБЖУ.
          </p>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.type} className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-medium text-muted-foreground">{MEAL_NAMES[group.type] || group.type}</h3>
          {group.meals.map((meal) => (
            <article key={meal.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold tabular-nums">{Math.round(meal.totalKcal || 0)} ккал</span>
                  <span className="text-xs text-muted-foreground">
                    Б {Math.round(meal.totalProtein || 0)} · Ж {Math.round(meal.totalFat || 0)} · У{" "}
                    {Math.round(meal.totalCarbs || 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMeal(meal.id)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Удалить приём пищи"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-foreground">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {Math.round(item.grams)} г · {Math.round(item.kcal)} ккал
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
