const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const GROQ_LLM_MODEL = "llama-3.3-70b-versatile"
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

export interface FoodItem {
  name: string
  grams: number
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface AnalysisResult {
  items: FoodItem[]
  totals: { kcal: number; protein: number; fat: number; carbs: number }
}

export interface PlanMeal {
  type: string
  title: string
  items: FoodItem[]
}

export interface PlanResult {
  meals: PlanMeal[]
  note: string
}

const SYSTEM_PROMPT = `Ты — опытный нутрициолог. Пользователь описывает, что он съел.
Твоя задача: определить каждый продукт, оценить примерный вес порции в граммах
(«немного» ≈ 100 г, «большая котлета» ≈ 120 г, «тарелка» ≈ 300 г, яйцо С0 ≈ 65 г и т.п.)
и рассчитать КБЖУ по стандартным справочным данным.

Ответь СТРОГО валидным JSON без каких-либо пояснений, markdown или текста вокруг:
{
  "items": [
    {"name": "название продукта", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}
  ]
}

Если в сообщении нет ничего про еду, верни {"items": []}.`

const PHOTO_PROMPT = `Ты — опытный нутрициолог. На фото — еда, которую съел пользователь.
Определи каждый продукт/блюдо на фото, оцени примерный вес порции в граммах
по визуальному размеру и рассчитай КБЖУ по стандартным справочным данным.

Ответь СТРОГО валидным JSON без каких-либо пояснений, markdown или текста вокруг:
{
  "items": [
    {"name": "название продукта", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}
  ]
}

Названия продуктов пиши на русском языке.
Если на фото нет еды, верни {"items": []}.`

const PRODUCTS_PHOTO_PROMPT = `Ты — помощник по продуктам. На фото — продукты, которые есть у пользователя дома
(например, содержимое холодильника, стола или пакета с покупками).
Перечисли все продукты, которые ты видишь на фото. Если видно количество или упаковку —
укажи примерно (например, «десяток яиц», «пачка творога 200 г»).

Ответь СТРОГО валидным JSON без пояснений, markdown или текста вокруг:
{
  "products": ["продукт 1", "продукт 2"]
}

Названия пиши на русском языке.
Если на фото нет продуктов, верни {"products": []}.`

function planPrompt(targets: { kcal: number; protein: number; fat: number; carbs: number }) {
  return `Ты — опытный нутрициолог. Пользователь перечисляет продукты, которые у него есть дома.
Составь рацион на день (завтрак, обед, ужин и при необходимости перекус) ТОЛЬКО из этих продуктов.

Требования:
- Дневная цель пользователя: ${Math.round(targets.kcal)} ккал, белки ${Math.round(targets.protein)} г, жиры ${Math.round(targets.fat)} г, углеводы ${Math.round(targets.carbs)} г.
- Постарайся попасть в цель по калориям как можно точнее (±5%), сбалансируй БЖУ.
- Указывай вес каждого продукта в граммах и способ приготовления (варка, тушение, запекание — без жарки в масле, если масла нет в списке).
- Не выдумывай продукты, которых нет в списке (соль, перец, вода — можно).
- Если продуктов слишком мало для полноценного дня, составь что получится и честно отметь это в "note".

Ответь СТРОГО валидным JSON без пояснений, markdown или текста вокруг:
{
  "meals": [
    {
      "type": "breakfast|lunch|dinner|snack",
      "title": "название блюда/приёма",
      "items": [
        {"name": "продукт и способ приготовления", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}
      ]
    }
  ],
  "note": "краткий совет или пустая строка"
}

Названия пиши на русском языке.`
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  const raw = match[0].replace(/,\s*([}\]])/g, "$1")
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseItems(rawItems: unknown[]): FoodItem[] {
  const items: FoodItem[] = []
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) continue
    const o = it as Record<string, unknown>
    items.push({
      name: String(o.name ?? "?"),
      grams: toNum(o.grams),
      kcal: toNum(o.kcal),
      protein: toNum(o.protein),
      fat: toNum(o.fat),
      carbs: toNum(o.carbs),
    })
  }
  return items
}

function computeTotals(items: FoodItem[]) {
  return {
    kcal: Math.round(items.reduce((s, i) => s + i.kcal, 0)),
    protein: Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10,
    fat: Math.round(items.reduce((s, i) => s + i.fat, 0) * 10) / 10,
    carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10,
  }
}

async function groqChat(payload: Record<string, unknown>): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90_000),
      })
      if (!resp.ok) continue
      const data = await resp.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content === "string") return content
    } catch {
      // ретрай
    }
  }
  return null
}

async function requestAnalysis(payload: Record<string, unknown>): Promise<AnalysisResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await groqChat(payload)
    if (!content) continue
    const data = extractJson(content)
    if (data && Array.isArray(data.items)) {
      const items = parseItems(data.items)
      return { items, totals: computeTotals(items) }
    }
  }
  return null
}

export async function analyzeFood(text: string): Promise<AnalysisResult | null> {
  return requestAnalysis({
    model: GROQ_LLM_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  })
}

export async function analyzeFoodPhoto(imageBase64: string, caption = ""): Promise<AnalysisResult | null> {
  let userText = PHOTO_PROMPT
  if (caption) userText += `\n\nКомментарий пользователя к фото: ${caption}`
  return requestAnalysis({
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  })
}

export async function listProductsFromPhoto(imageBase64: string, caption = ""): Promise<string[] | null> {
  let userText = PRODUCTS_PHOTO_PROMPT
  if (caption) userText += `\n\nКомментарий пользователя к фото: ${caption}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await groqChat({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })
    if (!content) continue
    const data = extractJson(content)
    if (data && Array.isArray(data.products)) {
      return data.products.map((p) => String(p)).filter((p) => p.trim())
    }
  }
  return null
}

export async function generateMealPlan(
  products: string,
  targets: { kcal: number; protein: number; fat: number; carbs: number },
): Promise<PlanResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await groqChat({
      model: GROQ_LLM_MODEL,
      messages: [
        { role: "system", content: planPrompt(targets) },
        { role: "user", content: `Мои продукты: ${products}` },
      ],
      temperature: 0.4,
      max_tokens: 2500,
    })
    if (!content) continue
    const data = extractJson(content)
    if (data && Array.isArray(data.meals)) {
      const meals: PlanMeal[] = []
      for (const m of data.meals) {
        if (typeof m !== "object" || m === null) continue
        const o = m as Record<string, unknown>
        const items = Array.isArray(o.items) ? parseItems(o.items) : []
        if (items.length > 0) {
          meals.push({
            type: String(o.type ?? "snack"),
            title: String(o.title ?? ""),
            items,
          })
        }
      }
      if (meals.length > 0) {
        return { meals, note: String(data.note ?? "") }
      }
    }
  }
  return null
}
