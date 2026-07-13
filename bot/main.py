"""Точка входа: запуск бота (long polling)."""
import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

from config import BOT_TOKEN, GROQ_API_KEY, MINI_APP_URL
from db.database import init_db
from handlers import meals, plan, reports, sleep, start, subscribe, water
from middlewares.activity import ActivityTracker
from middlewares.subscription import SubscriptionGate
from services.notifier import notify_loop

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fitflow")


async def main():
    missing = [
        name for name, val in
        [("BOT_TOKEN", BOT_TOKEN), ("GROQ_API_KEY", GROQ_API_KEY)]
        if not val
    ]
    if missing:
        log.error("Не заданы переменные окружения: %s", ", ".join(missing))
        sys.exit(1)

    await init_db()

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()

    # Кнопка меню, открывающая Mini App (если задан публичный URL)
    if MINI_APP_URL.startswith("https://"):
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Дневник", web_app=WebAppInfo(url=MINI_APP_URL)
                )
            )
            log.info("Кнопка Mini App установлена: %s", MINI_APP_URL)
        except Exception as e:
            log.warning("Не удалось установить кнопку Mini App: %s", e)
    else:
        log.info("MINI_APP_URL не задан — кнопка Mini App не установлена")

    # Отметка активности (для напоминаний), затем блокировка по подписке
    tracker = ActivityTracker()
    dp.message.outer_middleware(tracker)
    dp.callback_query.outer_middleware(tracker)

    gate = SubscriptionGate()
    dp.message.outer_middleware(gate)
    dp.callback_query.outer_middleware(gate)

    # Порядок важен: подписка и онбординг (FSM) раньше общего обработчика еды
    dp.include_router(subscribe.router)
    dp.include_router(start.router)
    dp.include_router(reports.router)
    dp.include_router(water.router)
    dp.include_router(sleep.router)
    dp.include_router(plan.router)
    dp.include_router(meals.router)

    # Фоновые напоминания о неактивности
    asyncio.create_task(notify_loop(bot))

    log.info("Бот запущен (long polling)")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
