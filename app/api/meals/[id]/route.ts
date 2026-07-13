import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { mealItems, meals } from "@/lib/db/schema"
import { authFromRequest } from "@/lib/telegram-auth"

/** DELETE /api/meals/:id — удалить приём пищи (только свой) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authFromRequest(req)
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const mealId = Number(id)
  if (!Number.isInteger(mealId)) {
    return Response.json({ error: "invalid id" }, { status: 400 })
  }

  const deleted = await db
    .delete(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, auth.user.id)))
    .returning({ id: meals.id })

  if (deleted.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  // meal_items удаляются каскадом (FK ON DELETE CASCADE), но продублируем на случай его отсутствия
  await db.delete(mealItems).where(eq(mealItems.mealId, mealId))

  return Response.json({ ok: true })
}
