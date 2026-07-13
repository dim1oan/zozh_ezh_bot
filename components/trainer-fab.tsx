"use client"

import { Loader2, Send, X } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { apiFetch, haptic } from "@/lib/telegram-client"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Составь план тренировок на неделю",
  "Что съесть перед тренировкой?",
  "Как накачать пресс дома?",
  "Сколько белка мне нужно в день?",
]

export function TrainerFab() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    setError(null)
    setInput("")
    const next: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await apiFetch("/api/trainer", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) throw new Error("request failed")
      const data = await res.json()
      setMessages([...next, { role: "assistant", content: data.reply }])
      haptic("light")
    } catch {
      setError("Не удалось получить ответ. Попробуйте ещё раз.")
      haptic("error")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* Плавающая кнопка-ёжик */}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            haptic("light")
          }}
          aria-label="Открыть чат с ёжиком-тренером"
          className="fixed bottom-24 right-4 z-30 flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-lg shadow-primary/30 transition-transform active:scale-95"
        >
          <Image
            src="/images/trainer-hedgehog.png"
            alt=""
            width={56}
            height={56}
            className="size-full scale-[1.8] object-cover"
          />
        </button>
      )}

      {/* Оверлей чата */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Чат с ёжиком-тренером"
          className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-background"
        >
          {/* Шапка */}
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card">
              <Image
                src="/images/trainer-hedgehog.png"
                alt=""
                width={40}
                height={40}
                className="size-full scale-[1.8] object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Ёжик-тренер</h2>
              <p className="text-xs text-muted-foreground">Тренировки, питание, сон</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
              className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
            >
              <X className="size-5" />
            </button>
          </header>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <span className="flex size-20 items-center justify-center overflow-hidden rounded-3xl bg-card">
                  <Image
                    src="/images/trainer-hedgehog.png"
                    alt="Ёжик-тренер"
                    width={80}
                    height={80}
                    className="size-full scale-[1.8] object-cover"
                  />
                </span>
                <div>
                  <h3 className="text-base font-semibold">Ёжик-тренер</h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                    Спросите про тренировки, питание, сон или восстановление — отвечу с учётом вашего профиля и целей.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl bg-card px-4 py-2.5 text-left text-sm text-secondary-foreground transition-colors hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2" aria-live="polite">
                {messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "self-end rounded-br-md bg-primary text-primary-foreground"
                        : "self-start rounded-bl-md bg-card"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {"Ёжик печатает..."}
                  </div>
                )}
                {error && <p className="self-start text-xs text-destructive">{error}</p>}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Поле ввода */}
          <div
            className="flex items-end gap-2 border-t border-border p-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Вопрос тренеру..."
              aria-label="Сообщение ёжику-тренеру"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Отправить"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
