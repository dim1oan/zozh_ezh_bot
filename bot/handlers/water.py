"""Водный баланс: быстрое добавление воды и дневной прогресс."""
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from db import database as db
from keyboards.inline import BTN_WATER, water_kb

router = Router()

DEFAULT_TARGET_ML = 2000.0


def water_target_ml(user: dict) -> float:
    """Норма воды: 30 мл на кг веса, иначе 2000 мл."""
    weight = user.get("weight")
    if weight:
        return round(float(weight) * 30)
    return DEFAULT_TARGET_ML


def format_water(total: float, target: float) -> str:
    pct = min(total / target, 1.0) if target else 0
    filled = round(pct * 10)
    bar = "🟦" * filled + "⬜" * (10 - filled)
    text = (
        f"💧 <b>Водный баланс за сегодня</b>\n\n"
        f"{bar}\n"
        f"<b>{total:.0f} / {target:.0f} мл</b> ({pct * 100:.0f}%)"
    )
    remaining = target - total
    if remaining > 0:
        glasses = -(-remaining // 250)  # округление вверх
        text += f"\n\nОсталось: {remaining:.0f} мл (~{glasses:.0f} стак. по 250 мл)"
    else:
        text += "\n\n✅ Дневная норма выполнена!"
    return text


async def _require_user(message: Message) -> dict | None:
    user = await db.get_user(message.from_user.id)
    if not user:
        await message.answer("Сначала настрой профиль: /start")
        return None
    return user


@router.message(Command("water"))
@router.message(F.text == BTN_WATER)
async def cmd_water(message: Message):
    user = await _require_user(message)
    if not user:
        return
    total = await db.get_today_water(user["id"])
    await message.answer(
        format_water(total, water_target_ml(user)), reply_markup=water_kb()
    )


@router.callback_query(F.data.startswith("water:"))
async def cb_water(cb: CallbackQuery):
    user = await db.get_user(cb.from_user.id)
    if not user:
        await cb.answer("Сначала настрой профиль: /start", show_alert=True)
        return

    action = cb.data.split(":")[1]
    if action == "undo":
        ok = await db.delete_last_water(user["id"])
        if not ok:
            await cb.answer("Нечего отменять.", show_alert=True)
            return
        note = "Последняя запись удалена."
    else:
        amount = float(action)
        await db.add_water(user["id"], amount)
        note = f"+{amount:.0f} мл записано!"

    total = await db.get_today_water(user["id"])
    await cb.message.edit_text(
        format_water(total, water_target_ml(user)), reply_markup=water_kb()
    )
    await cb.answer(note)
