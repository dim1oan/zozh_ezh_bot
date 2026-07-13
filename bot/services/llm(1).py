"""Анализ КБЖУ через Groq API (OpenAI-совместимый)."""
import base64
import json
import re

import httpx

from config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_LLM_MODEL, GROQ_VISION_MODEL

SYSTEM_PROMPT = """Ты — опытный нутрициолог. Пользователь описывает, что он съел.
Твоя задача: определить каждый продукт, оценить примерный вес порции в граммах
(«немного» ≈ 100 г, «большая котлета» ≈ 120 г, «тарелка» ≈ 300 г, яйцо С0 ≈ 65 г и т.п.)
и рассчитать КБЖУ по стандартным справочным данным.

Ответь СТРОГО валидным JSON без каких-либо пояснений, markdown или текста вокруг:
{
  "items": [
    {"name": "название продукта", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}
  ]
}

Если в сообщении нет ничего про еду, верни {"items": []}."""

PHOTO_PROMPT = """Ты — опытный нутрициолог. На фото — еда, которую съел пользователь.
Определи каждый продукт/блюдо на фото, оцени примерный вес порции в граммах
по визуальному размеру и рассчитай КБЖУ по стандартным справочным данным.

Ответь СТРОГО валидным JSON без каких-либо пояснений, markdown или текста вокруг:
{
  "items": [
    {"name": "название продукта", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}
  ]
}

Названия продуктов пиши на русском языке.
Если на фото нет еды, верни {"items": []}."""


def _extract_json(text: str) -> dict | None:
    """Достаёт JSON из ответа модели, даже если вокруг мусор."""
    text = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    raw = match.group(0)
    # простой "json-repair": убрать висячие запятые
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _request_analysis(payload: dict) -> dict | None:
    """Отправляет запрос в Groq и возвращает распарсенный результат КБЖУ."""
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}

    async with httpx.AsyncClient(timeout=90) as client:
        for _ in range(2):  # ретрай при невалидном JSON
            try:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions", json=payload, headers=headers
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
            except (httpx.HTTPError, KeyError, IndexError):
                continue

            data = _extract_json(content)
            if data is not None and isinstance(data.get("items"), list):
                items = []
                for it in data["items"]:
                    try:
                        items.append({
                            "name": str(it.get("name", "?")),
                            "grams": float(it.get("grams", 0) or 0),
                            "kcal": float(it.get("kcal", 0) or 0),
                            "protein": float(it.get("protein", 0) or 0),
                            "fat": float(it.get("fat", 0) or 0),
                            "carbs": float(it.get("carbs", 0) or 0),
                        })
                    except (TypeError, ValueError):
                        continue
                totals = {
                    "kcal": round(sum(i["kcal"] for i in items)),
                    "protein": round(sum(i["protein"] for i in items), 1),
                    "fat": round(sum(i["fat"] for i in items), 1),
                    "carbs": round(sum(i["carbs"] for i in items), 1),
                }
                return {"items": items, "totals": totals}
    return None


async def analyze_food(text: str) -> dict | None:
    """Анализ КБЖУ по текстовому описанию еды."""
    payload = {
        "model": GROQ_LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "temperature": 0.2,
        "max_tokens": 1500,
    }
    return await _request_analysis(payload)


PLAN_PROMPT = """Ты — опытный нутрициолог. Пользователь перечисляет продукты, которые у него есть дома.
Составь рацион на день (завтрак, обед, ужин и при необходимости перекус) ТОЛЬКО из этих продуктов.

Требования:
- Дневная цель пользователя: {kcal} ккал, белки {protein} г, жиры {fat} г, углеводы {carbs} г.
- Постарайся попасть в цель по калориям как можно точнее (±5%), сбалансируй БЖУ.
- Указывай вес каждого продукта в граммах и способ приготовления (варка, тушение, запекание — без жарки в масле, если масла нет в списке).
- Не выдумывай продукты, которых нет в списке (соль, перец, вода — можно).
- Если продуктов слишком мало для полноценного дня, составь что получится и честно отметь это в "note".

Ответь СТРОГО валидным JSON без пояснений, markdown или текста вокруг:
{{
  "meals": [
    {{
      "type": "breakfast|lunch|dinner|snack",
      "title": "название блюда/приёма",
      "items": [
        {{"name": "продукт и способ приготовления", "grams": число, "kcal": число, "protein": число, "fat": число, "carbs": число}}
      ]
    }}
  ],
  "note": "краткий совет или пустая строка"
}}

Названия пиши на русском языке."""


async def generate_meal_plan(products: str, targets: dict) -> dict | None:
    """Составляет рацион на день из имеющихся продуктов под цель пользователя."""
    system = PLAN_PROMPT.format(
        kcal=round(targets.get("kcal") or 2000),
        protein=round(targets.get("protein") or 100),
        fat=round(targets.get("fat") or 70),
        carbs=round(targets.get("carbs") or 250),
    )
    payload = {
        "model": GROQ_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Мои продукты: {products}"},
        ],
        "temperature": 0.4,
        "max_tokens": 2500,
    }

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    async with httpx.AsyncClient(timeout=90) as client:
        for _ in range(2):
            try:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions", json=payload, headers=headers
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
            except (httpx.HTTPError, KeyError, IndexError):
                continue

            data = _extract_json(content)
            if data is not None and isinstance(data.get("meals"), list):
                meals = []
                for m in data["meals"]:
                    items = []
                    for it in m.get("items", []):
                        try:
                            items.append({
                                "name": str(it.get("name", "?")),
                                "grams": float(it.get("grams", 0) or 0),
                                "kcal": float(it.get("kcal", 0) or 0),
                                "protein": float(it.get("protein", 0) or 0),
                                "fat": float(it.get("fat", 0) or 0),
                                "carbs": float(it.get("carbs", 0) or 0),
                            })
                        except (TypeError, ValueError):
                            continue
                    if items:
                        meals.append({
                            "type": str(m.get("type", "snack")),
                            "title": str(m.get("title", "")),
                            "items": items,
                        })
                if meals:
                    return {"meals": meals, "note": str(data.get("note", "") or "")}
    return None


PRODUCTS_PHOTO_PROMPT = """Ты — помощник по продуктам. На фото — продукты, которые есть у пользователя дома
(например, содержимое холодильника, стола или пакета с покупками).
Перечисли все продукты, которые ты видишь на фото. Если видно количество или упаковку —
укажи примерно (например, «десяток яиц», «пачка творога 200 г»).

Ответь СТРОГО валидным JSON без пояснений, markdown или текста вокруг:
{
  "products": ["продукт 1", "продукт 2"]
}

Названия пиши на русском языке.
Если на фото нет продуктов, верни {"products": []}."""


async def list_products_from_photo(image_bytes: bytes, caption: str = "") -> list[str] | None:
    """Распознаёт список продуктов на фото (vision-модель). None при ошибке."""
    b64 = base64.b64encode(image_bytes).decode()
    user_text = PRODUCTS_PHOTO_PROMPT
    if caption:
        user_text += f"\n\nКомментарий пользователя к фото: {caption}"

    payload = {
        "model": GROQ_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1000,
    }

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    async with httpx.AsyncClient(timeout=90) as client:
        for _ in range(2):
            try:
                resp = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions", json=payload, headers=headers
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
            except (httpx.HTTPError, KeyError, IndexError):
                continue

            data = _extract_json(content)
            if data is not None and isinstance(data.get("products"), list):
                return [str(p) for p in data["products"] if str(p).strip()]
    return None


async def analyze_food_photo(image_bytes: bytes, caption: str = "") -> dict | None:
    """Анализ КБЖУ по фотографии еды (vision-модель)."""
    b64 = base64.b64encode(image_bytes).decode()
    user_text = PHOTO_PROMPT
    if caption:
        user_text += f"\n\nКомментарий пользователя к фото: {caption}"

    payload = {
        "model": GROQ_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1500,
    }
    return await _request_analysis(payload)
