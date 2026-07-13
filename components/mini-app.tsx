"use client"

import { Flame, Send } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { BottomNav, type Tab } from "@/components/bottom-nav"
import { Paywall } from "@/components/paywall"
import { AddScreen } from "@/components/screens/add-screen"
import { PlanScreen } from "@/components/screens/plan-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import { SleepScreen } from "@/components/screens/sleep-screen"
import { StatsScreen } from "@/components/screens/stats-screen"
import { TodayScreen } from "@/components/screens/today-screen"
import { TrainerFab } from "@/components/trainer-fab"
import { WorkoutsScreen } from "@/components/screens/workouts-screen"
import { getInitData, getTelegramWebApp, swrFetcher } from "@/lib/telegram-client"
import type { Profile } from "@/lib/types"

const TAB_TITLES: Record<Tab, string> = {
  today: "Сегодня",
  add: "Добавить еду",
  plan: "Рацион на день",
  workouts: "Тренировки",
  sleep: "Сон",
  stats: "Статистика",
  profile: "Профиль",
  settings: "Настройки",
}

export function MiniApp() {
  const [ready, setReady] = useState(false)
  const [inTelegram, setInTelegram] = useState(false)
  const [tab, setTab] = useState<Tab>("today")

  useEffect(() => {
    const wa = getTelegramWebApp()
    if (wa && wa.initData) {
      wa.ready()
      wa.expand()
      setInTelegram(true)
    }
    setReady(true)
  }, [])

  const { data, isLoading, mutate } = useSWR<{
    profile: Profile
    subscription?: { active: boolean; trial: boolean; until: string | null }
  }>(ready && inTelegram && getInitData() ? "/api/profile" : null, swrFetcher)

  if (!ready) return null

  if (!inTelegram) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Flame className="size-8" />
        </span>
        <h1 className="text-xl font-semibold">FitFlow — дневник КБЖУ</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
          Это приложение работает внутри Telegram. Откройте бота и нажмите кнопку меню, чтобы запустить его.
        </p>
        <a
          href="https://t.me/zozh_ezh_bot"
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Send className="size-4" />
          Открыть бота
        </a>
      </main>
    )
  }

  if (isLoading || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </main>
    )
  }

  if (data.subscription && !data.subscription.active) {
    return <Paywall onPaid={() => mutate()} />
  }

  const profile = data.profile
  const needsOnboarding = !profile.calorieTarget

  if (needsOnboarding) {
    return (
      <main className="mx-auto max-w-md p-4">
        <ProfileScreen profile={profile} onboarding onSaved={(p) => mutate({ profile: p })} />
      </main>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Flame className="size-4" />
        </span>
        <h1 className="text-base font-semibold">{TAB_TITLES[tab]}</h1>
      </header>

      <main className="flex-1 p-4 pb-28">
        {tab === "today" && <TodayScreen profile={profile} />}
        {tab === "add" && <AddScreen onSaved={() => setTab("today")} />}
        {tab === "plan" && <PlanScreen />}
        {tab === "workouts" && <WorkoutsScreen />}
        {tab === "sleep" && <SleepScreen profile={profile} />}
        {tab === "stats" && <StatsScreen profile={profile} />}
        {tab === "profile" && <ProfileScreen profile={profile} onSaved={(p) => mutate({ profile: p })} />}
        {tab === "settings" && <SettingsScreen profile={profile} />}
      </main>

      <TrainerFab />
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
