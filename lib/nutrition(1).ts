export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Минимальная (сидячий образ)" },
  { value: 1.375, label: "Лёгкая (1-3 тренировки/нед)" },
  { value: 1.55, label: "Средняя (3-5 тренировок/нед)" },
  { value: 1.725, label: "Высокая (6-7 тренировок/нед)" },
] as const

export const GOALS = [
  { value: "lose", label: "Похудение", delta: -0.15 },
  { value: "keep", label: "Поддержание", delta: 0.0 },
  { value: "gain", label: "Набор массы", delta: 0.12 },
] as const

export const MEAL_NAMES: Record<string, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
}

export interface Targets {
  calorieTarget: number
  proteinTarget: number
  fatTarget: number
  carbTarget: number
}

/** Формула Миффлина-Сан Жеора — та же, что в боте. */
export function calcTargets(
  gender: string,
  age: number,
  height: number,
  weight: number,
  activity: number,
  goal: string,
): Targets {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === "m" ? 5 : -161)
  const tdee = bmr * activity
  const delta = GOALS.find((g) => g.value === goal)?.delta ?? 0
  const kcal = tdee * (1 + delta)

  const protein = 1.8 * weight
  const fat = 1.0 * weight
  const carbs = Math.max((kcal - protein * 4 - fat * 9) / 4, 0)

  return {
    calorieTarget: Math.round(kcal),
    proteinTarget: Math.round(protein),
    fatTarget: Math.round(fat),
    carbTarget: Math.round(carbs),
  }
}

export function mealTypeByTime(hour: number): string {
  if (hour >= 5 && hour < 11) return "breakfast"
  if (hour >= 11 && hour < 16) return "lunch"
  if (hour >= 16 && hour < 22) return "dinner"
  return "snack"
}
