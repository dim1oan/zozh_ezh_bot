"use client"

import { useEffect, useState } from "react"
import type { Tab } from "@/components/bottom-nav"

export type NavMode = "scroll" | "all"

export interface NavPrefs {
  mode: NavMode
  /** Скрытые вкладки (вкладку «Настройки» скрыть нельзя) */
  hidden: Tab[]
}

const STORAGE_KEY = "nav-prefs"
const EVENT = "nav-prefs-changed"

const DEFAULT_PREFS: NavPrefs = { mode: "scroll", hidden: [] }

function readPrefs(): NavPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<NavPrefs>
    return {
      mode: parsed.mode === "all" ? "all" : "scroll",
      hidden: Array.isArray(parsed.hidden) ? (parsed.hidden.filter((t) => t !== "settings") as Tab[]) : [],
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function useNavPrefs(): [NavPrefs, (next: NavPrefs) => void] {
  const [prefs, setPrefs] = useState<NavPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    setPrefs(readPrefs())
    const onChange = () => setPrefs(readPrefs())
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  function update(next: NavPrefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setPrefs(next)
    window.dispatchEvent(new Event(EVENT))
  }

  return [prefs, update]
}
