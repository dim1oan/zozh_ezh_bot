"use client"

import { Camera, Loader2, X } from "lucide-react"
import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { MEAL_NAMES, mealTypeByTime } from "@/lib/nutrition"
import { apiFetch, haptic } from "@/lib/telegram-client"
import type { FoodItem, Totals } from "@/lib/types"

interface AddScreenProps {
  onSaved: () => void
}

type Analysis = { items: FoodItem[]; totals: Totals }

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function AddScreen({ onSaved }: AddScreenProps) {
  const { mutate } = useSWRConfig()
  const [text, setText] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [mealType, setMealType] = useState(() => mealTypeByTime(new Date().getHours()))
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickPhoto(file: File | null) {
    setPhoto(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function analyze() {
    if (!text.trim() && !photo) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      let res: Response
      if (photo) {
        const image = await fileToBase64(photo)
        res = await apiFetch("/api/analyze-photo", {
          method: "POST",
          body: JSON.stringify({ image, caption: text.trim() }),
        })
      } else {
        res = await apiFetch("/api/analyze", {
          method: "POST",
          body: JSON.stringify({ text: text.trim() }),
        })
      }
      if (!res.ok) throw new Error("analysis failed")
      const data: Analysis = await res.json()
      if (!data.items || data.items.length === 0) {
        setError("Не нашёл еды в описании. Попробуй сформулировать иначе.")
      } else {
        setAnalysis(data)
        haptic("success")
      }
    } catch {
      setError("Не удалось проанализировать. Попробуй ещё раз.")
      haptic("error")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!analysis) return
    setSaving(true)
    try {
      const res = await apiFetch("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          mealType,
          rawText: photo ? `фото${text.trim() ? ` (${text.trim()})` : ""}` : text.trim(),
          items: analysis.items,
          totals: analysis.totals,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      haptic("success")
      setText("")
      pickPhoto(null)
      setAnalysis(null)
      mutate("/api/meals")
      onSaved()
    } catch {
      setError("Не удалось сохранить. Попробуй ещё раз.")
      haptic("error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <h2 className="text-sm font-medium">Что ты съел?</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={photo ? "Комментарий к фото (необязательно)..." : "Например: три яйца, тарелка гречки и куриная грудка..."}
          rows={3}
          className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {photoPreview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Фото еды" className="h-28 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => pickPhoto(null)}
              className="absolute -right-2 -top-2 rounded-full bg-secondary p-1 text-foreground"
              aria-label="Убрать фото"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Camera className="size-4" />
            Прикрепить фото еды
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={analyze}
          disabled={loading || (!text.trim() && !photo)}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Анализирую..." : "Посчитать КБЖУ"}
        </button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {analysis && (
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <h2 className="text-sm font-medium">Разбор</h2>
          <ul className="flex flex-col gap-2">
            {analysis.items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                <span>{item.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {Math.round(item.grams)} г · {Math.round(item.kcal)} ккал
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Итого</span>
            <span className="tabular-nums">
              {Math.round(analysis.totals.kcal)} ккал · Б {analysis.totals.protein} · Ж {analysis.totals.fat} · У{" "}
              {analysis.totals.carbs}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Тип приёма пищи">
            {Object.entries(MEAL_NAMES).map(([type, name]) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={mealType === type}
                onClick={() => setMealType(type)}
                className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                  mealType === type ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </section>
      )}
    </div>
  )
}
