"""Слой работы с базой данных (Neon Postgres + asyncpg)."""
import asyncpg
from datetime import datetime, timedelta

from config import DATABASE_URL


def _aware(dt: datetime) -> datetime:
    """Преобразует naive datetime в aware (локальная зона) для TIMESTAMPTZ."""
    return dt.astimezone() if dt.tzinfo is None else dt

_pool: asyncpg.Pool | None = None

# Разрешённые поля для upsert_user — защита от SQL-инъекций в именах колонок
_USER_FIELDS = {
    "gender", "age", "height", "weight", "activity", "goal",
    "calorie_target", "protein_target", "fat_target", "carb_target",
}


async def init_db():
    """Создаёт пул подключений к Neon. Схема уже создана через Neon MCP."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)


async def close_db():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_user(tg_id: int) -> dict | None:
    row = await _pool.fetchrow("SELECT * FROM users WHERE tg_id = $1", tg_id)
    return dict(row) if row else None


async def upsert_user(tg_id: int, **fields):
    fields = {k: v for k, v in fields.items() if k in _USER_FIELDS}
    async with _pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (tg_id) VALUES ($1) ON CONFLICT (tg_id) DO NOTHING", tg_id
        )
        if fields:
            sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
            await conn.execute(
                f"UPDATE users SET {sets} WHERE tg_id = $1",
                tg_id, *fields.values(),
            )


async def save_meal(user_id: int, meal_type: str, raw_text: str, items: list[dict], totals: dict) -> int:
    async with _pool.acquire() as conn:
        async with conn.transaction():
            meal_id = await conn.fetchval(
                "INSERT INTO meals (user_id, meal_type, eaten_at, raw_text, total_kcal, total_protein, total_fat, total_carbs) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
                user_id, meal_type, _aware(datetime.now()), raw_text,
                float(totals.get("kcal", 0) or 0), float(totals.get("protein", 0) or 0),
                float(totals.get("fat", 0) or 0), float(totals.get("carbs", 0) or 0),
            )
            for it in items:
                await conn.execute(
                    "INSERT INTO meal_items (meal_id, name, grams, kcal, protein, fat, carbs) "
                    "VALUES ($1, $2, $3, $4, $5, $6, $7)",
                    meal_id, str(it.get("name", "?")), float(it.get("grams", 0) or 0),
                    float(it.get("kcal", 0) or 0), float(it.get("protein", 0) or 0),
                    float(it.get("fat", 0) or 0), float(it.get("carbs", 0) or 0),
                )
            return meal_id


async def delete_last_meal(user_id: int) -> bool:
    async with _pool.acquire() as conn:
        meal_id = await conn.fetchval(
            "SELECT id FROM meals WHERE user_id = $1 ORDER BY eaten_at DESC LIMIT 1", user_id
        )
        if meal_id is None:
            return False
        await conn.execute("DELETE FROM meals WHERE id = $1", meal_id)
        return True


async def get_meals_between(user_id: int, start: datetime, end: datetime) -> list[dict]:
    rows = await _pool.fetch(
        "SELECT * FROM meals WHERE user_id = $1 AND eaten_at >= $2 AND eaten_at < $3 ORDER BY eaten_at",
        user_id, _aware(start), _aware(end),
    )
    result = []
    for r in rows:
        d = dict(r)
        # Совместимость с обработчиками: eaten_at как ISO-строка в локальной зоне
        d["eaten_at"] = d["eaten_at"].astimezone().isoformat()
        result.append(d)
    return result


async def get_meal_items(meal_id: int) -> list[dict]:
    rows = await _pool.fetch("SELECT * FROM meal_items WHERE meal_id = $1", meal_id)
    return [dict(r) for r in rows]


async def get_today_meals(user_id: int) -> list[dict]:
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return await get_meals_between(user_id, start, start + timedelta(days=1))


async def add_water(user_id: int, amount_ml: float) -> None:
    await _pool.execute(
        "INSERT INTO water_log (user_id, amount_ml, drunk_at) VALUES ($1, $2, $3)",
        user_id, float(amount_ml), _aware(datetime.now()),
    )


async def get_today_water(user_id: int) -> float:
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total = await _pool.fetchval(
        "SELECT COALESCE(SUM(amount_ml), 0) FROM water_log "
        "WHERE user_id = $1 AND drunk_at >= $2 AND drunk_at < $3",
        user_id, _aware(start), _aware(start + timedelta(days=1)),
    )
    return float(total or 0)


async def delete_last_water(user_id: int) -> bool:
    async with _pool.acquire() as conn:
        row_id = await conn.fetchval(
            "SELECT id FROM water_log WHERE user_id = $1 ORDER BY drunk_at DESC LIMIT 1",
            user_id,
        )
        if row_id is None:
            return False
        await conn.execute("DELETE FROM water_log WHERE id = $1", row_id)
        return True


# ---------- Подписка ----------

TRIAL_DAYS = 3


def subscription_status(user: dict) -> dict:
    """Считает статус подписки по записи users.

    Возвращает {"active": bool, "trial": bool, "until": datetime | None}.
    """
    now = _aware(datetime.now())
    paid_until = user.get("paid_until")
    if paid_until is not None and paid_until > now:
        return {"active": True, "trial": False, "until": paid_until}

    created = user.get("created_at")
    if created is not None:
        trial_end = created + timedelta(days=TRIAL_DAYS)
        if trial_end > now:
            return {"active": True, "trial": True, "until": trial_end}

    return {"active": False, "trial": False, "until": paid_until}


async def get_subscription(tg_id: int) -> dict:
    """Статус подписки по tg_id. Незнакомый пользователь получает триал с этого момента."""
    user = await get_user(tg_id)
    if user is None:
        await upsert_user(tg_id)
        user = await get_user(tg_id)
    return subscription_status(user)


async def extend_subscription(tg_id: int, days: int = 30) -> datetime:
    """Продлевает подписку на N дней от текущего конца (или от сейчас)."""
    now = _aware(datetime.now())
    async with _pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (tg_id) VALUES ($1) ON CONFLICT (tg_id) DO NOTHING", tg_id
        )
        current = await conn.fetchval(
            "SELECT paid_until FROM users WHERE tg_id = $1", tg_id
        )
        base = current if current is not None and current > now else now
        new_until = base + timedelta(days=days)
        await conn.execute(
            "UPDATE users SET paid_until = $2 WHERE tg_id = $1", tg_id, new_until
        )
        return new_until


async def create_payment(user_id: int, provider: str, external_id: str | None, amount: str) -> int:
    return await _pool.fetchval(
        "INSERT INTO payments (user_id, provider, external_id, amount, status) "
        "VALUES ($1, $2, $3, $4, 'pending') RETURNING id",
        user_id, provider, external_id, amount,
    )


async def get_payment(payment_id: int) -> dict | None:
    row = await _pool.fetchrow("SELECT * FROM payments WHERE id = $1", payment_id)
    return dict(row) if row else None


async def mark_payment(payment_id: int, status: str) -> None:
    await _pool.execute(
        "UPDATE payments SET status = $2 WHERE id = $1", payment_id, status
    )


# ---------- Сон ----------

def sleep_duration_min(start: str, end: str) -> int:
    """Минуты сна между HH:MM; если конец «раньше» начала — сон через полночь."""
    sh, sm = map(int, start.split(":"))
    eh, em = map(int, end.split(":"))
    mins = eh * 60 + em - (sh * 60 + sm)
    if mins <= 0:
        mins += 24 * 60
    return mins


async def save_sleep(user_id: int, sleep_date, start: str, end: str) -> int:
    """Сохраняет сон за дату пробуждения (upsert). Возвращает длительность в минутах."""
    duration = sleep_duration_min(start, end)
    await _pool.execute(
        "INSERT INTO sleep_log (user_id, sleep_date, start_time, end_time, duration_min) "
        "VALUES ($1, $2, $3, $4, $5) "
        "ON CONFLICT (user_id, sleep_date) DO UPDATE "
        "SET start_time = $3, end_time = $4, duration_min = $5",
        user_id, sleep_date, start, end, duration,
    )
    return duration


async def set_dream(user_id: int, sleep_date, dream: str) -> bool:
    result = await _pool.execute(
        "UPDATE sleep_log SET dream = $3 WHERE user_id = $1 AND sleep_date = $2",
        user_id, sleep_date, dream,
    )
    return result.endswith("1")


async def get_sleep(user_id: int, sleep_date) -> dict | None:
    row = await _pool.fetchrow(
        "SELECT * FROM sleep_log WHERE user_id = $1 AND sleep_date = $2",
        user_id, sleep_date,
    )
    return dict(row) if row else None


async def get_sleep_window(user_id: int) -> tuple[str, str]:
    """Последний записанный режим сна (для тихих часов уведомлений)."""
    row = await _pool.fetchrow(
        "SELECT start_time, end_time FROM sleep_log "
        "WHERE user_id = $1 ORDER BY sleep_date DESC LIMIT 1",
        user_id,
    )
    if row:
        return row["start_time"], row["end_time"]
    return "23:00", "08:00"


# ---------- Активность и напоминания ----------

async def touch_activity(tg_id: int) -> None:
    """Обновляет отметку последней активности пользователя."""
    await _pool.execute(
        "INSERT INTO users (tg_id, last_active) VALUES ($1, now()) "
        "ON CONFLICT (tg_id) DO UPDATE SET last_active = now()",
        tg_id,
    )


async def get_inactive_users() -> list[dict]:
    """Пользователи с включёнными напоминаниями, неактивные дольше своего порога
    и ещё не уведомлённые с момента последней активности."""
    rows = await _pool.fetch(
        "SELECT id, tg_id, notify_hours FROM users "
        "WHERE COALESCE(notify_enabled, TRUE) "
        "AND last_active IS NOT NULL "
        "AND last_active < now() - make_interval(hours => COALESCE(notify_hours, 6)) "
        "AND (last_notified IS NULL OR last_notified < last_active)"
    )
    return [dict(r) for r in rows]


async def mark_notified(tg_id: int) -> None:
    await _pool.execute(
        "UPDATE users SET last_notified = now() WHERE tg_id = $1", tg_id
    )
