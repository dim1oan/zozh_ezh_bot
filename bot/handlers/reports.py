"""Отчёты: /today, /week, /stats."""
from datetime import datetime, timedelta

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message

from db import database as db
from keyboards.inline import BTN_STATS, BTN_TODAY, BTN_WEEK
from services.nutrition import MEAL_NAMES

router = Router()

WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


async def _require_user(message: Message) -> dict | None:
    user = await db.get_user(message.from_user.id)
    if not user:
        await message.answer("Сначала настрой профиль: /start")
        return None
    return user


@router.message(Command("today"))
@router.message(F.text == BTN_TODAY)
async def cmd_today(message: Message):
    user = await _require_user(message)
    if not user:
        return
    meals = await db.get_today_meals(user["id"])
    if not meals:
        await message.answer("📭 Сегодня ещё нет записей. Напиши или наговори, что ты съел!")
        return

    lines = [f"📅 <b>Сегодня, {datetime.now().strftime('%d.%m.%Y')}</b>\n"]
    totals = {"kcal": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}

    for mtype in ("breakfast", "lunch", "dinner", "snack"):
        group = [m for m in meals if m["meal_type"] == mtype]
        if not group:
            continue
        lines.append(f"<b>{MEAL_NAMES[mtype]}</b>")
        for m in group:
            items = await db.get_meal_items(m["id"])
            for it in items:
                lines.append(f"  • {it['name']} ({it['grams']:.0f} г) — {it['kcal']:.0f} ккал")
            totals["kcal"] += m["total_kcal"] or 0
            totals["protein"] += m["total_protein"] or 0
            totals["fat"] += m["total_fat"] or 0
            totals["carbs"] += m["total_carbs"] or 0
        lines.append("")

    lines.append(
        f"<b>Итого: {totals['kcal']:.0f} ккал</b>\n"
        f"🥩 Белки: {totals['protein']:.1f} г | 🧈 Жиры: {totals['fat']:.1f} г | 🍞 Углеводы: {totals['carbs']:.1f} г"
    )
    if user.get("calorie_target"):
        remaining = user["calorie_target"] - totals["kcal"]
        if remaining >= 0:
            lines.append(f"\n🎯 Осталось до цели: <b>{remaining:.0f} ккал</b> из {user['calorie_target']:.0f}")
        else:
            lines.append(f"\n⚠️ Норма превышена на <b>{-remaining:.0f} ккал</b>")

    water_total = await db.get_today_water(user["id"])
    water_target = round(float(user["weight"]) * 30) if user.get("weight") else 2000
    lines.append(f"\n💧 Вода: <b>{water_total:.0f} / {water_target:.0f} мл</b>")

    await message.answer("\n".join(lines))


@router.message(Command("week"))
@router.message(F.text == BTN_WEEK)
async def cmd_week(message: Message):
    user = await _require_user(message)
    if not user:
        return
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=6)
    meals = await db.get_meals_between(user["id"], start, today + timedelta(days=1))

    lines = ["📆 <b>Неделя</b>\n<pre>День   Ккал     Б     Ж     У</pre>"]
    rows = []
    total_kcal = 0.0
    for i in range(7):
        day = start + timedelta(days=i)
        day_meals = [m for m in meals if m["eaten_at"][:10] == day.strftime("%Y-%m-%d")]
        kcal = sum(m["total_kcal"] or 0 for m in day_meals)
        p = sum(m["total_protein"] or 0 for m in day_meals)
        f = sum(m["total_fat"] or 0 for m in day_meals)
        c = sum(m["total_carbs"] or 0 for m in day_meals)
        total_kcal += kcal
        rows.append(f"{WEEKDAYS[day.weekday()]} {day.strftime('%d.%m')} {kcal:5.0f} {p:5.0f} {f:5.0f} {c:5.0f}")
    lines.append("<pre>" + "\n".join(rows) + "</pre>")
    lines.append(f"Среднее за день: <b>{total_kcal / 7:.0f} ккал</b>")
    if user.get("calorie_target"):
        lines.append(f"Твоя норма: {user['calorie_target']:.0f} ккал/день")
    await message.answer("\n".join(lines))


@router.message(Command("stats"))
@router.message(F.text == BTN_STATS)
async def cmd_stats(message: Message):
    user = await _require_user(message)
    if not user:
        return
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=29)
    meals = await db.get_meals_between(user["id"], start, today + timedelta(days=1))
    if not meals:
        await message.answer("📭 Пока нет данных для статистики.")
        return

    days = {m["eaten_at"][:10] for m in meals}
    n = max(len(days), 1)
    kcal = sum(m["total_kcal"] or 0 for m in meals) / n
    p = sum(m["total_protein"] or 0 for m in meals) / n
    f = sum(m["total_fat"] or 0 for m in meals) / n
    c = sum(m["total_carbs"] or 0 for m in meals) / n

    text = (
        f"📈 <b>Статистика за 30 дней</b>\n\n"
        f"Дней с записями: <b>{len(days)}</b>\n"
        f"Приёмов пищи: <b>{len(meals)}</b>\n\n"
        f"<b>В среднем за день:</b>\n"
        f"🔥 {kcal:.0f} ккал\n"
        f"🥩 Белки: {p:.1f} г\n"
        f"🧈 Жиры: {f:.1f} г\n"
        f"🍞 Углеводы: {c:.1f} г"
    )
    if user.get("calorie_target"):
        diff = kcal - user["calorie_target"]
        text += f"\n\n🎯 Норма: {user['calorie_target']:.0f} ккал ({'+' if diff > 0 else ''}{diff:.0f} к среднему)"
    await message.answer(text)
