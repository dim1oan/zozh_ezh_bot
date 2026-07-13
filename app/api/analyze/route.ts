import { authFromRequest } from "@/lib/telegram-auth"
import { analyzeFood } from "@/lib/llm"

export const maxDuration = 60

export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== "string") {
    return Response.json({ error: "text required" }, { status: 400 })
  }

  const result = await analyzeFood(text)
  if (!result) return Response.json({ error: "analysis_failed" }, { status: 502 })
  return Response.json(result)
}
