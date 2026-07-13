"""Middleware: блокирует функции бота после окончания триала/подписки.

Всегда доступны: /start, /settings, /subscribe, кнопка подписки,
онбординг и все платёжные колбэки.
"""
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from db import database as db
from keyboards.inline import BTN_SETTINGS, BTN_SUB, pay_methods_kb

# Команды и кнопки, доступные без подписки
_ALLOWED_COMMANDS = ("/start", "/settings", "/subscribe", "/help", "/cancel")
_ALLOWED_TEXTS = {BTN_SETTINGS, BTN_SUB}
# Колбэки онбординга и оплаты
_ALLOWED_CB_PREFIXES = ("gender:", "activity:", "goal:", "pay:", "paycheck:")

_PAYWALL_TEXT = (
    "⛔ Пробный период закончился.\n\n"
    "Чтобы продолжить пользоваться ботом, оформи подписку — "
    "<b>100 ₽/мес</b>, все функции без ограничений.\n\n"
    "Выбери способ оплаты:"
)


class SubscriptionGate(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        if isinstance(event, Message):
            if event.successful_payment is not None:
                return await handler(event, data)
            text = (event.text or "").strip()
            if text.split("@")[0].split(" ")[0] in _ALLOWED_COMMANDS or text in _ALLOWED_TEXTS:
                return await handler(event, data)
            # Пользователь в диалоге (онбординг и т.п.) — не блокируем
            state = data.get("state")
            if state is not None and await state.get_state() is not None:
                return await handler(event, data)
            sub = await db.get_subscription(event.from_user.id)
            if sub["active"]:
                return await handler(event, data)
            await event.answer(_PAYWALL_TEXT, reply_markup=pay_methods_kb())
            return None

        if isinstance(event, CallbackQuery):
            cb_data = event.data or ""
            if cb_data.startswith(_ALLOWED_CB_PREFIXES):
                return await handler(event, data)
            sub = await db.get_subscription(event.from_user.id)
            if sub["active"]:
                return await handler(event, data)
            await event.answer("⛔ Подписка закончилась. Открой «⭐ Подписка» в меню.", show_alert=True)
            return None

        return await handler(event, data)
