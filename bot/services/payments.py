"""Платёжные провайдеры: ЮKassa (СБП) и CryptoBot (Crypto Pay API).

Telegram Stars обрабатывается нативно через aiogram (send_invoice, currency XTR)
и отдельного сервиса не требует.
"""
import uuid

import httpx

from config import (
    CRYPTO_PAY_TOKEN,
    SUB_PRICE_RUB,
    YOOKASSA_SECRET_KEY,
    YOOKASSA_SHOP_ID,
)

YOOKASSA_API = "https://api.yookassa.ru/v3"
CRYPTO_PAY_API = "https://pay.crypt.bot/api"


def yookassa_enabled() -> bool:
    return bool(YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY)


def crypto_enabled() -> bool:
    return bool(CRYPTO_PAY_TOKEN)


# ---------- ЮKassa (СБП) ----------

async def yookassa_create_payment(tg_id: int) -> dict | None:
    """Создаёт платёж СБП. Возвращает {"id", "url"} или None при ошибке."""
    payload = {
        "amount": {"value": f"{SUB_PRICE_RUB}.00", "currency": "RUB"},
        "confirmation": {
            "type": "redirect",
            "return_url": "https://t.me",
        },
        "capture": True,
        "description": f"Подписка FitFlow на 30 дней (tg {tg_id})",
        "payment_method_data": {"type": "sbp"},
        "metadata": {"tg_id": str(tg_id)},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{YOOKASSA_API}/payments",
                json=payload,
                auth=(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY),
                headers={"Idempotence-Key": str(uuid.uuid4())},
            )
            resp.raise_for_status()
            data = resp.json()
            url = (data.get("confirmation") or {}).get("confirmation_url")
            if data.get("id") and url:
                return {"id": data["id"], "url": url}
    except httpx.HTTPError:
        pass
    return None


async def yookassa_check_payment(payment_id: str) -> bool:
    """True, если платёж успешно оплачен."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{YOOKASSA_API}/payments/{payment_id}",
                auth=(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY),
            )
            resp.raise_for_status()
            return resp.json().get("status") == "succeeded"
    except httpx.HTTPError:
        return False


# ---------- CryptoBot (Crypto Pay) ----------

async def crypto_create_invoice(tg_id: int) -> dict | None:
    """Создаёт крипто-инвойс на сумму, эквивалентную SUB_PRICE_RUB руб.

    Возвращает {"id", "url"} или None при ошибке.
    """
    payload = {
        "currency_type": "fiat",
        "fiat": "RUB",
        "amount": str(SUB_PRICE_RUB),
        "accepted_assets": "USDT,TON,BTC,ETH",
        "description": f"Подписка FitFlow на 30 дней (tg {tg_id})",
        "payload": str(tg_id),
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{CRYPTO_PAY_API}/createInvoice",
                json=payload,
                headers={"Crypto-Pay-API-Token": CRYPTO_PAY_TOKEN},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("ok"):
                inv = data["result"]
                return {"id": str(inv["invoice_id"]), "url": inv["bot_invoice_url"]}
    except httpx.HTTPError:
        pass
    return None


async def crypto_check_invoice(invoice_id: str) -> bool:
    """True, если крипто-инвойс оплачен."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{CRYPTO_PAY_API}/getInvoices",
                params={"invoice_ids": invoice_id},
                headers={"Crypto-Pay-API-Token": CRYPTO_PAY_TOKEN},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("ok"):
                items = data["result"].get("items", [])
                return bool(items) and items[0].get("status") == "paid"
    except httpx.HTTPError:
        pass
    return False
