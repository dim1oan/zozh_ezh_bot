"""Подписка: статус, оплата (Stars / СБП / крипта), проверка платежей."""
import logging

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, LabeledPrice, Message, PreCheckoutQuery

from config import PAYMENT_PROVIDER_TOKEN, SUB_DAYS, SUB_PRICE_RUB, SUB_PRICE_STARS
from db import database as db
from keyboards.inline import BTN_SUB, pay_check_kb, pay_methods_kb
from services import payments as pay

log = logging.getLogger("fitflow.subscribe")

router = Router()


def _fmt_date(dt) -> str:
    return dt.astimezone().strftime("%d.%m.%Y")


async def _status_text(tg_id: int) -> str:
    sub = await db.get_subscription(tg_id)
    if sub["active"] and sub["trial"]:
        return (
            f"🎁 У тебя <b>пробный период</b> до <b>{_fmt_date(sub['until'])}</b>.\n\n"
            f"Дальше — подписка <b>{SUB_PRICE_RUB} ₽/мес</b> со всеми функциями:\n"
            "• подсчёт КБЖУ текстом, голосом и по фото\n"
            "• вода, тренировки, статистика\n"
            "• Mini App с дневником\n\n"
            "Можно оплатить заранее — дни прибавятся к текущим."
        )
    if sub["active"]:
        return (
            f"✅ Подписка активна до <b>{_fmt_date(sub['until'])}</b>.\n\n"
            f"Продление: <b>{SUB_PRICE_RUB} ₽/мес</b> — дни прибавятся к текущим."
        )
    return (
        "⛔ Подписка закончилась.\n\n"
        f"Все функции — <b>{SUB_PRICE_RUB} ₽/мес</b>:\n"
        "• подсчёт КБЖУ текстом, голосом и по фото\n"
        "• вода, тренировки, статистика\n"
        "• Mini App с дневником\n\n"
        "Выбери способ оплаты:"
    )


@router.message(CommandStart(deep_link=True, magic=F.args == "sub"))
@router.message(Command("subscribe"))
@router.message(F.text == BTN_SUB)
async def cmd_subscribe(message: Message):
    text = await _status_text(message.from_user.id)
    await message.answer(text, reply_markup=pay_methods_kb())


# ---------- Выбор способа оплаты ----------

@router.callback_query(F.data == "pay:card")
async def cb_pay_card(cb: CallbackQuery):
    """Оплата картой через ЮKassa (Telegram Payments, токен из BotFather)."""
    if not PAYMENT_PROVIDER_TOKEN:
        await cb.answer(
            "Оплата картой пока не подключена. Выбери другой способ.",
            show_alert=True,
        )
        return
    await cb.message.answer_invoice(
        title="Подписка FitFlow — 30 дней",
        description="Все функции: КБЖУ, фото, голос, вода, тренировки, Mini App",
        payload="sub:card",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[LabeledPrice(label="Подписка на 30 дней", amount=SUB_PRICE_RUB * 100)],
    )
    await cb.answer()


@router.callback_query(F.data == "pay:stars")
async def cb_pay_stars(cb: CallbackQuery):
    await cb.message.answer_invoice(
        title="Подписка FitFlow — 30 дней",
        description="Все функции: КБЖУ, фото, голос, вода, тренировки, Mini App",
        payload="sub:stars",
        currency="XTR",
        prices=[LabeledPrice(label="Подписка на 30 дней", amount=SUB_PRICE_STARS)],
    )
    await cb.answer()


@router.callback_query(F.data == "pay:crypto")
async def cb_pay_crypto(cb: CallbackQuery):
    if not pay.crypto_enabled():
        await cb.answer(
            "Оплата криптой пока не подключена. Выбери карту или Stars.",
            show_alert=True,
        )
        return
    await cb.answer()
    result = await pay.crypto_create_invoice(cb.from_user.id)
    if result is None:
        await cb.message.answer("Не удалось создать крипто-счёт. Попробуй позже или выбери другой способ.")
        return
    payment_id = await db.create_payment(
        cb.from_user.id, "crypto", result["id"], f"{SUB_PRICE_RUB} RUB (crypto)"
    )
    await cb.message.answer(
        f"🪙 Оплата криптовалютой — эквивалент <b>{SUB_PRICE_RUB} ₽</b> (USDT, TON, BTC, ETH).\n\n"
        "1. Нажми «Перейти к оплате» — откроется @CryptoBot\n"
        "2. Оплати счёт\n"
        "3. Вернись и нажми «Я оплатил»",
        reply_markup=pay_check_kb(result["url"], "crypto", payment_id),
    )


# ---------- Проверка оплаты (СБП / крипта) ----------

@router.callback_query(F.data.startswith("paycheck:"))
async def cb_paycheck(cb: CallbackQuery):
    _, provider, raw_id = cb.data.split(":", 2)
    payment = await db.get_payment(int(raw_id))
    if payment is None or payment["user_id"] != cb.from_user.id:
        await cb.answer("Платёж не найден.", show_alert=True)
        return
    if payment["status"] == "succeeded":
        await cb.answer("Этот платёж уже засчитан ✅", show_alert=True)
        return

    if provider == "sbp":
        ok = await pay.yookassa_check_payment(payment["external_id"])
    else:
        ok = await pay.crypto_check_invoice(payment["external_id"])

    if not ok:
        await cb.answer("Оплата ещё не поступила. Подожди минуту и нажми ещё раз.", show_alert=True)
        return

    await db.mark_payment(payment["id"], "succeeded")
    until = await db.extend_subscription(cb.from_user.id, SUB_DAYS)
    log.info("Оплата %s подтверждена для tg %s", provider, cb.from_user.id)
    await cb.message.answer(
        f"🎉 Оплата получена! Подписка активна до <b>{_fmt_date(until)}</b>. Спасибо!"
    )
    await cb.answer()


# ---------- Telegram Payments (Stars и карта ЮKassa) ----------

@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    await query.answer(ok=True)


@router.message(F.successful_payment)
async def on_successful_payment(message: Message):
    sp = message.successful_payment
    if sp.currency == "XTR":
        provider, amount = "stars", f"{sp.total_amount} XTR"
    else:
        # Карта через ЮKassa: сумма приходит в копейках
        provider, amount = "card", f"{sp.total_amount / 100:.0f} {sp.currency}"
    pid = await db.create_payment(
        message.from_user.id, provider, sp.telegram_payment_charge_id, amount,
    )
    # Платёж от Telegram уже подтверждён — сразу помечаем и продлеваем
    await db.mark_payment(pid, "succeeded")
    until = await db.extend_subscription(message.from_user.id, SUB_DAYS)
    log.info("Оплата %s получена от tg %s", provider, message.from_user.id)
    await message.answer(
        f"🎉 Оплата получена! Подписка активна до <b>{_fmt_date(until)}</b>. Спасибо!"
    )
