"""Фоновые напоминания о неактивности (с учётом режима сна)."""
import asyncio
import logging
import random
from datetime import datetime

from aiogram import Bot

from db import database as db

log = logging.getLogger("fitflow.notifier")

CHECK_INTERVAL_SEC = 15 * 60  # проверка каждые 15 минут

REMINDERS = [
    "👋 Давно не виделись! Не забудь записать, что ты ел — я всё посчитаю.",
    "🍽 Как дела с питанием? Запиши приёмы пищи, чтобы не потерять прогресс.",
    "💧 Напоминаю про воду и дневник — пара секунд, а польза большая!",
    "📊 Загляни в дневник: запиши еду, воду или тренировку за сегодня.",
]


def _in_sleep_window(now_hm: str, start: str, end: str) -> bool:
    """True, если текущее время HH:MM попадает в окно сна (возможно через полночь)."""
    if start <= end:
        return start <= now_hm <= end
    return now_hm >= start or now_hm <= end


async def notify_loop(bot: Bot):
    """Бесконечный цикл: находит неактивных пользователей и шлёт напоминание."""
    while True:
        try:
            users = await db.get_inactive_users()
            now_hm = datetime.now().strftime("%H:%M")
            for u in users:
                try:
                    start, end = await db.get_sleep_window(u["id"])
                    if _in_sleep_window(now_hm, start, end):
                        continue  # не будим — попадает в режим сна
                    await bot.send_message(u["tg_id"], random.choice(REMINDERS))
                    await db.mark_notified(u["tg_id"])
                except Exception as e:
                    # Пользователь заблокировал бота и т.п. — просто помечаем
                    log.info("Не удалось отправить напоминание %s: %s", u["tg_id"], e)
                    await db.mark_notified(u["tg_id"])
        except Exception as e:
            log.warning("Ошибка цикла напоминаний: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SEC)
