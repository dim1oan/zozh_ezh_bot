import { authFromRequest } from "@/lib/telegram-auth"
import { analyzeFoodPhoto, listProductsFromPhoto } from "@/lib/llm"

export const maxDuration = 60

export async function POST(req: Request) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const { image, caption, mode } = await req.json()
  if (!image || typeof image !== "string") {
    return Response.json({ error: "image required" }, { status: 400 })
  }

  // mode="products" — распознать список продуктов (для рациона)
  if (mode === "products") {
    const products = await listProductsFromPhoto(image, caption || "")
    if (products === null) return Response.json({ error: "analysis_failed" }, { status: 502 })
    return Response.json({ products })
  }

  const result = await analyzeFoodPhoto(image, caption || "")
  if (!result) return Response.json({ error: "analysis_failed" }, { status: 502 })
  return Response.json(result)
}
