"""Отметка последней активности пользователя (для напоминаний о неактивности)."""
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from db import database as db


class ActivityTracker(BaseMiddleware):
    """Обновляет users.last_active при каждом сообщении или нажатии кнопки."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = None
        if isinstance(event, (Message, CallbackQuery)):
            user = event.from_user
        if user is not None:
            try:
                await db.touch_activity(user.id)
            except Exception:
                pass  # активность не должна ломать обработку
        return await handler(event, data)
