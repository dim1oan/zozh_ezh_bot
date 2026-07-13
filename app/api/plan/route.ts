import { generateMealPlan } from "@/lib/llm"
import { authFromRequest } from "@/lib/telegram-auth"

export const maxDuration = 60

/** POST /api/plan — рацион на день из имеющихся продуктов */
export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const { products } = await req.json()
  if (!products || typeof products !== "string") {
    return Response.json({ error: "products required" }, { status: 400 })
  }

  const targets = {
    kcal: auth.user.calorieTarget || 2000,
    protein: auth.user.proteinTarget || 100,
    fat: auth.user.fatTarget || 70,
    carbs: auth.user.carbTarget || 250,
  }

  const plan = await generateMealPlan(products, targets)
  if (!plan) return Response.json({ error: "plan_failed" }, { status: 502 })
  return Response.json({ ...plan, targets })
}
