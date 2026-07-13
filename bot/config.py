import os
from pathlib import Path


def _load_env_file() -> None:
    """Подгружает переменные из .env-файлов, если они не заданы в окружении."""
    candidates = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / ".env.development.local",
        Path(__file__).parent.parent / ".env",
    ]
    for path in candidates:
        if not path.is_file():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_file()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_LLM_MODEL = "llama-3.3-70b-versatile"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_WHISPER_MODEL = "whisper-large-v3"

DB_PATH = os.getenv("DB_PATH", "fitflow.db")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Публичный HTTPS-адрес Mini App (после публикации проекта на Vercel)
MINI_APP_URL = os.getenv("MINI_APP_URL", "")

# ---------- Подписка ----------
SUB_PRICE_RUB = 100          # цена подписки, руб/мес
SUB_PRICE_STARS = 60         # цена в Telegram Stars (~100 руб)
SUB_DAYS = 30                # длительность подписки в днях

# ЮKassa (СБП): ключи из личного кабинета yookassa.ru → Интеграция → Ключи API
YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY", "")

# ЮKassa через BotFather (Telegram Payments): токен вида 390540012:LIVE:...
# BotFather → /mybots → бот → Payments → ЮKassa
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")

# CryptoBot (крипта): токен из @CryptoBot → Crypto Pay → Create App
CRYPTO_PAY_TOKEN = os.getenv("CRYPTO_PAY_TOKEN", "")
