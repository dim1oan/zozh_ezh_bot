"""Одноразовая миграция данных из SQLite (fitflow.db) в Neon Postgres."""
import asyncio
import sqlite3
from datetime import datetime

import asyncpg

from config import DATABASE_URL, DB_PATH


def _parse_dt(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    return dt.astimezone() if dt.tzinfo is None else dt


async def main():
    lite = sqlite3.connect(DB_PATH)
    lite.row_factory = sqlite3.Row
    pg = await asyncpg.connect(DATABASE_URL)

    users = [dict(r) for r in lite.execute("SELECT * FROM users").fetchall()]
    meals = [dict(r) for r in lite.execute("SELECT * FROM meals").fetchall()]
    items = [dict(r) for r in lite.execute("SELECT * FROM meal_items").fetchall()]

    user_map: dict[int, int] = {}
    meal_map: dict[int, int] = {}

    async with pg.transaction():
        for u in users:
            new_id = await pg.fetchval(
                """INSERT INTO users (tg_id, gender, age, height, weight, activity, goal,
                       calorie_target, protein_target, fat_target, carb_target)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                   ON CONFLICT (tg_id) DO UPDATE SET gender = EXCLUDED.gender
                   RETURNING id""",
                u["tg_id"], u["gender"], u["age"], u["height"], u["weight"],
                u["activity"], u["goal"], u["calorie_target"], u["protein_target"],
                u["fat_target"], u["carb_target"],
            )
            user_map[u["id"]] = new_id

        for m in meals:
            new_id = await pg.fetchval(
                """INSERT INTO meals (user_id, meal_type, eaten_at, raw_text,
                       total_kcal, total_protein, total_fat, total_carbs)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id""",
                user_map[m["user_id"]], m["meal_type"], _parse_dt(m["eaten_at"]),
                m["raw_text"], m["total_kcal"], m["total_protein"],
                m["total_fat"], m["total_carbs"],
            )
            meal_map[m["id"]] = new_id

        for it in items:
            await pg.execute(
                """INSERT INTO meal_items (meal_id, name, grams, kcal, protein, fat, carbs)
                   VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                meal_map[it["meal_id"]], it["name"], it["grams"],
                it["kcal"], it["protein"], it["fat"], it["carbs"],
            )

    print(f"Перенесено: {len(users)} users, {len(meals)} meals, {len(items)} items")
    await pg.close()
    lite.close()


if __name__ == "__main__":
    asyncio.run(main())
