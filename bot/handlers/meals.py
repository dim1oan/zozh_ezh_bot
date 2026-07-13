"""Приём пищи: голос/текст → распознавание → анализ КБЖУ → подтверждение → сохранение."""
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from db import database as db
from keyboards.inline import BTN_UNDO, confirm_meal_kb
from services.llm import analyze_food, analyze_food_photo
from services.nutrition import MEAL_NAMES, meal_type_by_time
from services.speech import transcribe

router = Router()

# Ожидающие подтверждения анализы: tg_id -> {"text": ..., "items": ..., "totals": ...}
pending: dict[int, dict] = {}


def format_analysis(text: str, items: list[dict], totals: dict) -> str:
    lines = [f"🍽 <b>Разбор:</b> <i>{text}</i>\n"]
    for it in items:
        lines.append(
            f"• {it['name']} — {it['grams']:.0f} г\n"
            f"   {it['kcal']:.0f} ккал | Б {it['protein']:.1f} | Ж {it['fat']:.1f} | У {it['carbs']:.1f}"
        )
    lines.append(
        f"\n<b>Итого: {totals['kcal']} ккал</b>\n"
        f"🥩 {totals['protein']} г | 🧈 {totals['fat']} г | 🍞 {totals['carbs']} г\n\n"
        f"Выбери приём пищи, чтобы сохранить:"
    )
    return "\n".join(lines)


async def process_food_text(message: Message, text: str):
    status = await message.answer("🧠 Считаю КБЖУ...")
    result = await analyze_food(text)

    if result is None:
        await status.edit_text("😔 Не удалось проанализировать. Попробуй ещё раз чуть позже.")
        return
    if not result["items"]:
        await status.edit_text("🤔 Не нашёл ничего съедобного в сообщении. Опиши, что ты съел.")
        return

    pending[message.from_user.id] = {"text": text, **result}
    default_type = meal_type_by_time(datetime.now().hour)
    await status.edit_text(
        format_analysis(text, result["items"], result["totals"]),
        reply_markup=confirm_meal_kb(default_type),
    )


@router.message(F.voice)
async def handle_voice(message: Message, bot: Bot):
    status = await message.answer("🎧 Распознаю голосовое...")
    file = await bot.get_file(message.voice.file_id)
    buf = await bot.download_file(file.file_path)
    text = await transcribe(buf.read())
    await status.delete()

    if not text:
        await message.answer("😔 Не удалось распознать речь. Попробуй ещё раз или напиши текстом.")
        return

    await message.answer(f"📝 Распознал: <i>{text}</i>")
    await process_food_text(message, text)


@router.message(F.photo)
async def handle_photo(message: Message, bot: Bot):
    status = await message.answer("📷 Изучаю фото...")
    # Берём самое большое разрешение фото
    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    buf = await bot.download_file(file.file_path)

    caption = message.caption or ""
    result = await analyze_food_photo(buf.read(), caption)
    await status.delete()

    if result is None:
        await message.answer("😔 Не удалось проанализировать фото. Попробуй ещё раз чуть позже.")
        return
    if not result["items"]:
        await message.answer("🤔 Не нашёл еды на фото. Сфотографируй тарелку поближе или опиши текстом.")
        return

    desc = "фото" + (f" ({caption})" if caption else "")
    pending[message.from_user.id] = {"text": desc, **result}
    default_type = meal_type_by_time(datetime.now().hour)
    await message.answer(
        format_analysis(desc, result["items"], result["totals"]),
        reply_markup=confirm_meal_kb(default_type),
    )


@router.message(Command("undo"))
@router.message(F.text == BTN_UNDO)
async def cmd_undo(message: Message):
    user = await db.get_user(message.from_user.id)
    if not user:
        await message.answer("Сначала настрой профиль: /start")
        return
    ok = await db.delete_last_meal(user["id"])
    await message.answer("🗑 Последний приём пищи удалён." if ok else "Нечего удалять — записей нет.")


@router.callback_query(F.data.startswith("save:"))
async def cb_save(cb: CallbackQuery):
    data = pending.pop(cb.from_user.id, None)
    if data is None:
        await cb.answer("Данные устарели, отправь описание еды заново.", show_alert=True)
        return

    meal_type = cb.data.split(":")[1]
    user = await db.get_user(cb.from_user.id)
    if not user:
        await cb.message.edit_text("Сначала настрой профиль: /start")
        await cb.answer()
        return

    await db.save_meal(user["id"], meal_type, data["text"], data["items"], data["totals"])

    # Итог за день + проверка превышения нормы
    meals = await db.get_today_meals(user["id"])
    day_kcal = round(sum(m["total_kcal"] or 0 for m in meals))
    target = user.get("calorie_target")

    text = (
        f"✅ Сохранено в <b>{MEAL_NAMES[meal_type]}</b>: {data['totals']['kcal']} ккал\n\n"
        f"📊 За сегодня: <b>{day_kcal}"
    )
    if target:
        text += f" / {target:.0f} ккал</b>"
        remaining = target - day_kcal
        if remaining >= 0:
            text += f"\nОсталось: {remaining:.0f} ккал"
        else:
            text += f"\n⚠️ <b>Превышение нормы на {-remaining:.0f} ккал!</b>"
    else:
        text += " ккал</b>\nНастрой цель командой /settings"

    await cb.message.edit_text(text)
    await cb.answer("Сохранено!")


@router.callback_query(F.data == "cancel_meal")
async def cb_cancel(cb: CallbackQuery):
    pending.pop(cb.from_user.id, None)
    await cb.message.edit_text("❌ Отменено.")
    await cb.answer()


@router.message(F.text & ~F.text.startswith("/"))
async def handle_text(message: Message, state: FSMContext):
    # Не перехватываем сообщения во время онбординга (FSM)
    if await state.get_state() is not None:
        return
    await process_food_text(message, message.text)
