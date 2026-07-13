"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import useSWR from "swr"
import { swrFetcher } from "@/lib/telegram-client"
import type { DayReport, Profile } from "@/lib/types"

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]

interface StatsScreenProps {
  profile: Profile
}

export function StatsScreen({ profile }: StatsScreenProps) {
  const week = useSWR<{ days: DayReport[]; avg: DayReport }>("/api/reports?days=7", swrFetcher)
  const month = useSWR<{ days: DayReport[]; avg: DayReport }>("/api/reports?days=30", swrFetcher)

  const target = profile.calorieTarget || 2000
  const chartData =
    week.data?.days.map((d) => ({
      ...d,
      label: WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()],
    })) ?? []

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Калории за неделю</h2>
        {week.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-secondary)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                  formatter={(value) => [`${value ?? 0} ккал`, "Калории"]}
                  labelFormatter={(label, payload) => {
                    const date = (payload?.[0]?.payload as { date?: string } | undefined)?.date
                    return date ? `${label}, ${date}` : label
                  }}
                />
                <ReferenceLine y={target} stroke="var(--color-accent)" strokeDasharray="6 4" />
                <Bar dataKey="kcal" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Пунктир — твоя цель: {Math.round(target)} ккал</p>
      </section>

      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Средние за 30 дней</h2>
        {month.isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Загрузка...</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Ккал", value: month.data?.avg.kcal ?? 0 },
              { label: "Белки", value: month.data?.avg.protein ?? 0 },
              { label: "Жиры", value: month.data?.avg.fat ?? 0 },
              { label: "Углеводы", value: month.data?.avg.carbs ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
                <span className="text-lg font-semibold tabular-nums">{stat.value}</span>
                <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
