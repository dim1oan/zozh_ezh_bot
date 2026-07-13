"""Онбординг: /start, /settings — опрос и расчёт нормы КБЖУ."""
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from db import database as db
from keyboards.inline import BTN_SETTINGS, activity_kb, gender_kb, goal_kb, main_menu_kb
from services.nutrition import ACTIVITY_LEVELS, GOALS, calc_targets

router = Router()


class Onboarding(StatesGroup):
    age = State()
    height = State()
    weight = State()


@router.message(Command("start"))
@router.message(Command("settings"))
@router.message(F.text == BTN_SETTINGS)
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await db.upsert_user(message.from_user.id)
    await message.answer(
        "👋 Привет! Я помогу считать КБЖУ.\n\n"
        "Просто напиши или наговори голосовым, что ты съел — я всё посчитаю и запомню.\n\n"
        "Сначала настроим твою цель. Укажи пол:",
        reply_markup=gender_kb(),
    )


@router.callback_query(F.data.startswith("gender:"))
async def cb_gender(cb: CallbackQuery, state: FSMContext):
    await state.update_data(gender=cb.data.split(":")[1])
    await state.set_state(Onboarding.age)
    await cb.message.edit_text("Сколько тебе лет? (например: 25)")
    await cb.answer()


@router.message(Onboarding.age)
async def msg_age(message: Message, state: FSMContext):
    try:
        age = int(message.text.strip())
        assert 5 <= age <= 120
    except (ValueError, AssertionError):
        await message.answer("Введи возраст числом, например: 25")
        return
    await state.update_data(age=age)
    await state.set_state(Onboarding.height)
    await message.answer("Твой рост в см? (например: 178)")


@router.message(Onboarding.height)
async def msg_height(message: Message, state: FSMContext):
    try:
        height = float(message.text.replace(",", ".").strip())
        assert 100 <= height <= 250
    except (ValueError, AssertionError):
        await message.answer("Введи рост в сантиметрах, например: 178")
        return
    await state.update_data(height=height)
    await state.set_state(Onboarding.weight)
    await message.answer("Твой вес в кг? (например: 72)")


@router.message(Onboarding.weight)
async def msg_weight(message: Message, state: FSMContext):
    try:
        weight = float(message.text.replace(",", ".").strip())
        assert 25 <= weight <= 350
    except (ValueError, AssertionError):
        await message.answer("Введи вес в килограммах, например: 72")
        return
    await state.update_data(weight=weight)
    await state.set_state(None)
    await message.answer("Уровень активности:", reply_markup=activity_kb())


@router.callback_query(F.data.startswith("activity:"))
async def cb_activity(cb: CallbackQuery, state: FSMContext):
    key = cb.data.split(":")[1]
    await state.update_data(activity=ACTIVITY_LEVELS[key][0])
    await cb.message.edit_text("Какая у тебя цель?", reply_markup=goal_kb())
    await cb.answer()


@router.callback_query(F.data.startswith("goal:"))
async def cb_goal(cb: CallbackQuery, state: FSMContext):
    goal = cb.data.split(":")[1]
    data = await state.get_data()
    if not all(k in data for k in ("gender", "age", "height", "weight", "activity")):
        await cb.message.edit_text("Что-то пошло не так. Начни заново: /start")
        await cb.answer()
        return

    targets = calc_targets(
        data["gender"], data["age"], data["height"], data["weight"], data["activity"], goal
    )
    await db.upsert_user(
        cb.from_user.id,
        gender=data["gender"], age=data["age"], height=data["height"],
        weight=data["weight"], activity=data["activity"], goal=goal, **targets,
    )
    await state.clear()

    await cb.message.edit_text(
        f"✅ Готово! Твоя цель: <b>{GOALS[goal][0]}</b>\n\n"
        f"📊 Дневная норма:\n"
        f"🔥 Калории: <b>{targets['calorie_target']} ккал</b>\n"
        f"🥩 Белки: <b>{targets['protein_target']} г</b>\n"
        f"🧈 Жиры: <b>{targets['fat_target']} г</b>\n"
        f"🍞 Углеводы: <b>{targets['carb_target']} г</b>\n\n"
        f"Теперь просто напиши или отправь голосовое с тем, что ты съел. 🎤"
    )
    await cb.message.answer(
        "Кнопки меню — внизу экрана 👇", reply_markup=main_menu_kb()
    )
    await cb.answer()
