"""Рацион на день: пользователь перечисляет продукты, бот составляет меню под его цель."""
from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from db import database as db
from keyboards.inline import BTN_PLAN
from services.llm import generate_meal_plan, list_products_from_photo
from services.nutrition import MEAL_NAMES
from services.speech import transcribe

router = Router()


class PlanStates(StatesGroup):
    waiting_products = State()


@router.message(Command("plan"))
@router.message(F.text == BTN_PLAN)
async def cmd_plan(message: Message, state: FSMContext):
    user = await db.get_user(message.from_user.id)
    if not user or not user.get("calorie_target"):
        await message.answer("Сначала настрой профиль и цель: /start")
        return
    await state.set_state(PlanStates.waiting_products)
    await message.answer(
        "🍳 Перечисли продукты, которые у тебя есть — текстом, голосовым "
        "или просто пришли <b>фото продуктов</b> (холодильник, стол, покупки).\n\n"
        "Например: <i>куриное филе, гречка, яйца, творог, огурцы, "
        "помидоры, овсянка, молоко, бананы</i>\n\n"
        "Для отмены — /cancel"
    )


@router.message(PlanStates.waiting_products, Command("cancel"))
async def plan_cancel(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Отменено.")


def format_plan(plan: dict, targets: dict) -> str:
    lines = ["🍽 <b>Рацион на день из твоих продуктов</b>\n"]
    day = {"kcal": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}

    for meal in plan["meals"]:
        label = MEAL_NAMES.get(meal["type"], meal["type"])
        title = f" — {meal['title']}" if meal.get("title") else ""
        lines.append(f"<b>{label}{title}</b>")
        subtotal = 0.0
        for it in meal["items"]:
            lines.append(f"• {it['name']} — {it['grams']:.0f} г ({it['kcal']:.0f} ккал)")
            subtotal += it["kcal"]
            for k in day:
                day[k] += it[k]
        lines.append(f"<i>Итого: {subtotal:.0f} ккал</i>\n")

    lines.append(
        f"<b>Всего за день: {day['kcal']:.0f} ккал</b>\n"
        f"🥩 {day['protein']:.0f} г | 🧈 {day['fat']:.0f} г | 🍞 {day['carbs']:.0f} г"
    )
    if targets.get("kcal"):
        lines.append(f"🎯 Твоя цель: {targets['kcal']:.0f} ккал")
    if plan.get("note"):
        lines.append(f"\n💡 {plan['note']}")
    lines.append("\nКогда поешь — просто напиши или наговори, что съел, и я запишу.")
    return "\n".join(lines)


async def _build_plan(message: Message, state: FSMContext, products: str):
    user = await db.get_user(message.from_user.id)
    targets = {
        "kcal": user.get("calorie_target"),
        "protein": user.get("protein_target"),
        "fat": user.get("fat_target"),
        "carbs": user.get("carb_target"),
    }
    status = await message.answer("🧑‍🍳 Составляю рацион...")
    plan = await generate_meal_plan(products, targets)

    if plan is None:
        await status.edit_text("😔 Не удалось составить рацион. Попробуй ещё раз чуть позже.")
        await state.clear()
        return

    await state.clear()
    await status.edit_text(format_plan(plan, targets))


@router.message(PlanStates.waiting_products, F.voice)
async def plan_voice(message: Message, state: FSMContext, bot: Bot):
    status = await message.answer("🎧 Распознаю голосовое...")
    file = await bot.get_file(message.voice.file_id)
    buf = await bot.download_file(file.file_path)
    text = await transcribe(buf.read())
    await status.delete()

    if not text:
        await message.answer("😔 Не удалось распознать речь. Попробуй ещё раз или напиши текстом.")
        return
    await message.answer(f"📝 Распознал: <i>{text}</i>")
    await _build_plan(message, state, text)


@router.message(PlanStates.waiting_products, F.photo)
async def plan_photo(message: Message, state: FSMContext, bot: Bot):
    status = await message.answer("📷 Распознаю продукты на фото...")
    photo = message.photo[-1]
    file = await bot.get_file(photo.file_id)
    buf = await bot.download_file(file.file_path)

    caption = message.caption or ""
    products = await list_products_from_photo(buf.read(), caption)
    await status.delete()

    if products is None:
        await message.answer("😔 Не удалось распознать фото. Попробуй ещё раз или перечисли продукты текстом.")
        return
    if not products:
        await message.answer("🤔 Не нашёл продуктов на фото. Сфотографируй поближе или перечисли текстом.")
        return

    products_text = ", ".join(products)
    if caption:
        products_text += f", {caption}"
    await message.answer(f"📝 Нашёл продукты: <i>{products_text}</i>")
    await _build_plan(message, state, products_text)


@router.message(PlanStates.waiting_products, F.text)
async def plan_text(message: Message, state: FSMContext):
    await _build_plan(message, state, message.text)
