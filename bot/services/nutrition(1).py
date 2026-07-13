"""Расчёт нормы калорий (Миффлин-Сан Жеор) и распределение БЖУ."""

ACTIVITY_LEVELS = {
    "min": (1.2, "Минимальная (сидячий образ)"),
    "low": (1.375, "Лёгкая (1-3 тренировки/нед)"),
    "mid": (1.55, "Средняя (3-5 тренировок/нед)"),
    "high": (1.725, "Высокая (6-7 тренировок/нед)"),
}

GOALS = {
    "lose": ("Похудение", -0.15),
    "keep": ("Поддержание", 0.0),
    "gain": ("Набор массы", 0.12),
}


def calc_targets(gender: str, age: int, height: float, weight: float, activity: float, goal: str) -> dict:
    # Формула Миффлина-Сан Жеора
    bmr = 10 * weight + 6.25 * height - 5 * age + (5 if gender == "m" else -161)
    tdee = bmr * activity
    kcal = tdee * (1 + GOALS.get(goal, ("", 0.0))[1])

    # БЖУ: белок 1.8 г/кг, жиры 1 г/кг, остальное — углеводы
    protein = 1.8 * weight
    fat = 1.0 * weight
    carbs = max((kcal - protein * 4 - fat * 9) / 4, 0)

    return {
        "calorie_target": round(kcal),
        "protein_target": round(protein),
        "fat_target": round(fat),
        "carb_target": round(carbs),
    }


def meal_type_by_time(hour: int) -> str:
    if 5 <= hour < 11:
        return "breakfast"
    if 11 <= hour < 16:
        return "lunch"
    if 16 <= hour < 22:
        return "dinner"
    return "snack"


MEAL_NAMES = {
    "breakfast": "🌅 Завтрак",
    "lunch": "🍲 Обед",
    "dinner": "🌆 Ужин",
    "snack": "🍎 Перекус",
}
