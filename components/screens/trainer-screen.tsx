"use client"

import { Bot, Loader2, Send } from "lucide-react"
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

export function TrainerScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

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
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Bot className="size-7" />
          </span>
          <div>
            <h2 className="text-base font-semibold">AI-тренер</h2>
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
        <div className="flex flex-1 flex-col gap-2 pb-3" aria-live="polite">
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
              {"Тренер печатает..."}
            </div>
          )}
          {error && <p className="self-start text-xs text-destructive">{error}</p>}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Поле ввода */}
      <div className="sticky bottom-24 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Вопрос тренеру..."
          aria-label="Сообщение AI-тренеру"
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
  )
}
