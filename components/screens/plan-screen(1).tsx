"use client"

import { Camera, Loader2, X } from "lucide-react"
import { useRef, useState } from "react"
import { MEAL_NAMES } from "@/lib/nutrition"
import { apiFetch, haptic } from "@/lib/telegram-client"
import type { PlanMeal, Totals } from "@/lib/types"

type PlanData = { meals: PlanMeal[]; note: string; targets: Totals }

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

export function PlanScreen() {
  const [products, setProducts] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickPhoto(file: File | null) {
    setPhoto(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function generate() {
    if (!products.trim() && !photo) return
    setLoading(true)
    setError(null)
    setPlan(null)
    try {
      let productsText = products.trim()

      if (photo) {
        setStatus("Распознаю продукты на фото...")
        const image = await fileToBase64(photo)
        const res = await apiFetch("/api/analyze-photo", {
          method: "POST",
          body: JSON.stringify({ image, caption: productsText, mode: "products" }),
        })
        if (!res.ok) throw new Error("photo failed")
        const data = await res.json()
        if (!data.products || data.products.length === 0) {
          setError("Не нашёл продуктов на фото. Сфотографируй поближе или перечисли текстом.")
          return
        }
        productsText = data.products.join(", ") + (productsText ? `, ${productsText}` : "")
      }

      setStatus("Составляю рацион...")
      const res = await apiFetch("/api/plan", {
        method: "POST",
        body: JSON.stringify({ products: productsText }),
      })
      if (!res.ok) throw new Error("plan failed")
      const data: PlanData = await res.json()
      setPlan(data)
      haptic("success")
    } catch {
      setError("Не удалось составить рацион. Попробуй ещё раз.")
      haptic("error")
    } finally {
      setLoading(false)
      setStatus("")
    }
  }

  const dayTotals = plan
    ? plan.meals.flatMap((m) => m.items).reduce(
        (acc, it) => ({
          kcal: acc.kcal + it.kcal,
          protein: acc.protein + it.protein,
          fat: acc.fat + it.fat,
          carbs: acc.carbs + it.carbs,
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      )
    : null

  return (
    <div className="flex flex-col gap-4 pb-24">
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <h2 className="text-sm font-medium">Какие продукты у тебя есть?</h2>
        <textarea
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          placeholder={
            photo
              ? "Дополнение к фото (необязательно)..."
              : "Например: куриное филе, гречка, яйца, творог, огурцы, овсянка, бананы..."
          }
          rows={3}
          className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {photoPreview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Фото продуктов" className="h-28 rounded-xl object-cover" />
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
            Фото продуктов (холодильник, покупки)
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
          onClick={generate}
          disabled={loading || (!products.trim() && !photo)}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? status || "Генерирую..." : "Составить рацион на день"}
        </button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {plan && (
        <>
          {plan.meals.map((meal, i) => (
            <section key={i} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{MEAL_NAMES[meal.type] || meal.type}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(meal.items.reduce((s, it) => s + it.kcal, 0))} ккал
                </span>
              </div>
              {meal.title && <p className="text-xs text-muted-foreground">{meal.title}</p>}
              <ul className="flex flex-col gap-1 border-t border-border pt-2">
                {meal.items.map((item, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-2 text-xs">
                    <span>{item.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {Math.round(item.grams)} г · {Math.round(item.kcal)} ккал
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {dayTotals && (
            <section className="rounded-2xl bg-card p-4">
              <div className="flex items-baseline justify-between text-sm font-semibold">
                <span>Итого за день</span>
                <span className="tabular-nums">{Math.round(dayTotals.kcal)} ккал</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Б {Math.round(dayTotals.protein)} · Ж {Math.round(dayTotals.fat)} · У {Math.round(dayTotals.carbs)} —
                цель {Math.round(plan.targets.kcal)} ккал
              </p>
              {plan.note && <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground text-pretty">{plan.note}</p>}
            </section>
          )}
        </>
      )}
    </div>
  )
}
