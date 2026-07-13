"""Клавиатуры бота."""
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from services.nutrition import MEAL_NAMES

# Тексты кнопок главного меню
BTN_TODAY = "📅 Сегодня"
BTN_WEEK = "📆 Неделя"
BTN_STATS = "📈 Статистика"
BTN_UNDO = "🗑 Удалить последний"
BTN_SETTINGS = "⚙️ Настройки"
BTN_PLAN = "🍳 Рацион на день"
BTN_WATER = "💧 Вода"
BTN_SUB = "⭐ Подписка"
BTN_SLEEP = "😴 Сон"


def main_menu_kb() -> ReplyKeyboardMarkup:
    """Постоянное меню внизу экрана."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_TODAY), KeyboardButton(text=BTN_WEEK)],
            [KeyboardButton(text=BTN_WATER), KeyboardButton(text=BTN_SLEEP)],
            [KeyboardButton(text=BTN_PLAN), KeyboardButton(text=BTN_STATS)],
            [KeyboardButton(text=BTN_UNDO), KeyboardButton(text=BTN_SUB)],
            [KeyboardButton(text=BTN_SETTINGS)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Напиши или наговори, что ты съел...",
    )


def sleep_dream_kb() -> InlineKeyboardMarkup:
    """Предложение записать приснившийся сон."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌙 Приснился сон? Записать", callback_data="sleep:dream")],
    ])


def pay_methods_kb() -> InlineKeyboardMarkup:
    """Выбор способа оплаты подписки."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Карта (ЮKassa)", callback_data="pay:card")],
        [InlineKeyboardButton(text="⭐ Telegram Stars", callback_data="pay:stars")],
        [InlineKeyboardButton(text="🏦 СБП (ЮKassa)", callback_data="pay:sbp")],
        [InlineKeyboardButton(text="🪙 Криптовалюта", callback_data="pay:crypto")],
    ])


def pay_check_kb(url: str, provider: str, payment_id: int) -> InlineKeyboardMarkup:
    """Ссылка на оплату + кнопка проверки статуса."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Перейти к оплате", url=url)],
        [InlineKeyboardButton(text="✅ Я оплатил — проверить", callback_data=f"paycheck:{provider}:{payment_id}")],
    ])


def water_kb() -> InlineKeyboardMarkup:
    """Быстрое добавление воды."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="+150 мл", callback_data="water:150"),
            InlineKeyboardButton(text="+250 мл", callback_data="water:250"),
            InlineKeyboardButton(text="+500 мл", callback_data="water:500"),
        ],
        [InlineKeyboardButton(text="↩️ Отменить последнюю", callback_data="water:undo")],
    ])


def gender_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="👨 Мужской", callback_data="gender:m"),
        InlineKeyboardButton(text="👩 Женский", callback_data="gender:f"),
    ]])


def activity_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🪑 Минимальная", callback_data="activity:min")],
        [InlineKeyboardButton(text="🚶 Лёгкая (1-3 трен/нед)", callback_data="activity:low")],
        [InlineKeyboardButton(text="🏃 Средняя (3-5 трен/нед)", callback_data="activity:mid")],
        [InlineKeyboardButton(text="🏋️ Высокая (6-7 трен/нед)", callback_data="activity:high")],
    ])


def goal_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📉 Похудение", callback_data="goal:lose")],
        [InlineKeyboardButton(text="⚖️ Поддержание", callback_data="goal:keep")],
        [InlineKeyboardButton(text="📈 Набор массы", callback_data="goal:gain")],
    ])


def confirm_meal_kb(default_type: str) -> InlineKeyboardMarkup:
    """Кнопки выбора приёма пищи + отмена. Тип по умолчанию помечен галочкой."""
    rows = []
    row = []
    for key, label in MEAL_NAMES.items():
        text = f"{label} ✓" if key == default_type else label
        row.append(InlineKeyboardButton(text=text, callback_data=f"save:{key}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_meal")])
    return InlineKeyboardMarkup(inline_keyboard=rows)
