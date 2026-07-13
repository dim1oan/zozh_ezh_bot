"use client"

interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  colorScheme: "light" | "dark"
  openInvoice?: (url: string, callback?: (status: string) => void) => void
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
  HapticFeedback?: {
    notificationOccurred: (type: "error" | "success" | "warning") => void
    impactOccurred: (style: "light" | "medium" | "heavy") => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  return window.Telegram?.WebApp ?? null
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData || ""
}

export function haptic(type: "success" | "error" | "light" = "light") {
  const h = getTelegramWebApp()?.HapticFeedback
  if (!h) return
  if (type === "light") h.impactOccurred("light")
  else h.notificationOccurred(type)
}

/** fetch с заголовком initData и tz-параметром */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = new URL(path, window.location.origin)
  if (!url.searchParams.has("tz")) {
    url.searchParams.set("tz", String(new Date().getTimezoneOffset()))
  }
  return fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": getInitData(),
      ...options.headers,
    },
  })
}

export async function swrFetcher(path: string) {
  const res = await apiFetch(path)
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}
