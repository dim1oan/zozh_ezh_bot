"""Отслеживание сна: время, норма, дневник снов."""
import re
from datetime import date

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

from db import database as db
from keyboards.inline import BTN_SLEEP, sleep_dream_kb

router = Router()

# Форматы: «23:30 - 8:30», «23.30-08.30», «2330 830» и т.п.
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})"
)


class SleepStates(StatesGroup):
    waiting_time = State()
    waiting_dream = State()


def _sleep_norm(age) -> str:
    if age is not None and age < 18:
        return "8–10 часов"
    if age is not None and age >= 65:
        return "7–8 часов"
    return "7–9 часов"


def _fmt_duration(mins: int) -> str:
    h, m = divmod(mins, 60)
    return f"{h} ч {m:02d} мин" if m else f"{h} ч"


@router.message(Command("sleep"))
@router.message(F.text == BTN_SLEEP)
async def cmd_sleep(message: Message, state: FSMContext):
    user = await db.get_user(message.from_user.id)
    if user is None:
        await db.upsert_user(message.from_user.id)
        user = await db.get_user(message.from_user.id)

    lines = ["😴 <b>Сон</b>\n"]
    entry = await db.get_sleep(user["id"], date.today())
    if entry:
        lines.append(
            f"Сегодня: <b>{entry['start_time']} – {entry['end_time']}</b> "
            f"({_fmt_duration(entry['duration_min'])})"
        )
        if entry.get("dream"):
            lines.append("🌙 Сон записан в дневник")
    lines.append(f"\nРекомендуемая норма: <b>{_sleep_norm(user.get('age'))}</b>")
    lines.append(
        "\nОтправь время сна в формате:\n<code>23:30 - 8:30</code>\n"
        "(лёг — проснулся, запишется на сегодня)"
    )
    await state.set_state(SleepStates.waiting_time)
    await message.answer("\n".join(lines))


@router.message(SleepStates.waiting_time, F.text)
async def sleep_time_input(message: Message, state: FSMContext):
    m = _TIME_RANGE_RE.search(message.text or "")
    if not m:
        await state.clear()
        # Не похоже на время — отдаём сообщение общему обработчику еды
        from handlers.meals import handle_text
        return await handle_text(message, state)

    sh, sm, eh, em = (int(g) for g in m.groups())
    if not (0 <= sh < 24 and 0 <= sm < 60 and 0 <= eh < 24 and 0 <= em < 60):
        return await message.answer("Проверь время: часы 0–23, минуты 0–59. Попробуй ещё раз.")

    start_t = f"{sh:02d}:{sm:02d}"
    end_t = f"{eh:02d}:{em:02d}"

    user = await db.get_user(message.from_user.id)
    duration = await db.save_sleep(user["id"], date.today(), start_t, end_t)
    await state.clear()

    norm = _sleep_norm(user.get("age"))
    hours = duration / 60
    if 7 <= hours <= 9:
        verdict = "✅ В пределах нормы"
    elif hours < 7:
        verdict = f"⚠️ Меньше нормы ({norm})"
    else:
        verdict = f"💤 Больше нормы ({norm})"

    await message.answer(
        f"😴 Записал: <b>{start_t} – {end_t}</b>\n"
        f"Длительность: <b>{_fmt_duration(duration)}</b>\n{verdict}",
        reply_markup=sleep_dream_kb(),
    )


@router.callback_query(F.data == "sleep:dream")
async def ask_dream(callback: CallbackQuery, state: FSMContext):
    await state.set_state(SleepStates.waiting_dream)
    await callback.message.answer("🌙 Расскажи, что приснилось — я сохраню в дневник снов:")
    await callback.answer()


@router.message(SleepStates.waiting_dream, F.text)
async def dream_input(message: Message, state: FSMContext):
    user = await db.get_user(message.from_user.id)
    saved = await db.set_dream(user["id"], date.today(), (message.text or "").strip()[:2000])
    await state.clear()
    if saved:
        await message.answer("🌙 Сон сохранён в дневник. Посмотреть можно во вкладке «Сон» в приложении.")
    else:
        await message.answer("Сначала запиши время сна командой /sleep, потом добавим сон.")
