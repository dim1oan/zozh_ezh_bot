import { authFromRequest } from "@/lib/telegram-auth"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

const GOAL_LABELS: Record<string, string> = {
  lose: "похудение",
  keep: "поддержание веса",
  gain: "набор массы",
}

/** POST /api/trainer — { messages: [{ role, content }] } → { reply } */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return Response.json({ error: "GROQ_API_KEY is not set" }, { status: 500 })

  const body = await req.json()
  const incoming = Array.isArray(body?.messages) ? body.messages : []

  // Берём последние 12 сообщений, валидируем и обрезаем длину
  const messages = incoming
    .filter(
      (m: { role?: unknown; content?: unknown }) =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim(),
    )
    .slice(-12)
    .map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }))

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "last message must be from user" }, { status: 400 })
  }

  const u = auth.user
  const profileParts: string[] = []
  if (u.gender) profileParts.push(`пол: ${u.gender === "m" ? "мужской" : "женский"}`)
  if (u.age) profileParts.push(`возраст: ${u.age}`)
  if (u.height) profileParts.push(`рост: ${u.height} см`)
  if (u.weight) profileParts.push(`вес: ${u.weight} кг`)
  if (u.goal) profileParts.push(`цель: ${GOAL_LABELS[u.goal] || u.goal}`)
  if (u.calorieTarget) profileParts.push(`норма калорий: ${Math.round(u.calorieTarget)} ккал/день`)
  if (u.proteinTarget) profileParts.push(`белки: ${Math.round(u.proteinTarget)} г`)
  if (u.fatTarget) profileParts.push(`жиры: ${Math.round(u.fatTarget)} г`)
  if (u.carbTarget) profileParts.push(`углеводы: ${Math.round(u.carbTarget)} г`)

  const system = [
    "Ты — дружелюбный персональный фитнес-тренер и нутрициолог в приложении «Зож-Ёж».",
    "Отвечай на русском, кратко и по делу (до 250 слов), без markdown-заголовков.",
    "Можно использовать простые списки с дефисами. Дай конкретные, практичные советы.",
    "Ты консультируешь только по тренировкам, питанию, сну и восстановлению.",
    "Если вопрос не по теме — вежливо скажи, что ты тренер, и предложи вопрос по фитнесу.",
    "При симптомах болезни или травмах рекомендуй обратиться к врачу.",
    profileParts.length > 0 ? `Данные клиента: ${profileParts.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.6,
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    return Response.json({ error: "ai request failed" }, { status: 502 })
  }

  const data = await res.json()
  const reply: string = data?.choices?.[0]?.message?.content?.trim() || "Не получилось ответить, попробуйте ещё раз."

  return Response.json({ reply })
}
