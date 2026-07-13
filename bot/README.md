# FitFlow AI — Telegram-бот для подсчёта КБЖУ

Бот принимает голосовые и текстовые описания еды, распознаёт речь через Whisper (Groq),
анализирует КБЖУ через бесплатный Groq API (Llama 3.3 70B) и ведёт дневник питания.

Нужны всего **два ключа** — оба бесплатные, регистрация без номера телефона.

## Где взять ключи

1. **BOT_TOKEN** — напиши [@BotFather](https://t.me/BotFather) в Telegram, команда `/newbot`, скопируй токен.
2. **GROQ_API_KEY** — зарегистрируйся на [console.groq.com](https://console.groq.com) (через Google или GitHub), раздел «API Keys» → «Create API Key». Один ключ используется и для Whisper (голос), и для Llama 3.3 70B (анализ КБЖУ).

## Запуск

```bash
cd bot
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

export BOT_TOKEN="..."
export GROQ_API_KEY="..."

python main.py
```

## Команды бота

- `/start` — онбординг: пол, возраст, рост, вес, активность, цель. Расчёт нормы по Миффлину-Сан Жеору.
- Любое текстовое или голосовое сообщение с описанием еды — анализ КБЖУ и сохранение.
- `/today` — отчёт за сегодня по приёмам пищи.
- `/week` — сводка за неделю.
- `/stats` — средние показатели за 30 дней.
- `/undo` — удалить последний приём пищи.
- `/settings` — изменить параметры профиля.

## Структура проекта

```
bot/
├── main.py            # точка входа, long polling
├── config.py          # переменные окружения
├── handlers/          # обработчики: онбординг, еда, отчёты
├── services/          # llm.py (Groq Llama 3.3), speech.py (Whisper), nutrition.py (формулы)
├── keyboards/         # инлайн-клавиатуры
└── db/                # SQLite (aiosqlite)
```
