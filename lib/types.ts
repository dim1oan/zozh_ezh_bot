export interface FoodItem {
  name: string
  grams: number
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface Totals {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface Meal {
  id: number
  mealType: string
  rawText: string | null
  eatenAt: string
  totalKcal: number | null
  totalProtein: number | null
  totalFat: number | null
  totalCarbs: number | null
  items: (FoodItem & { id: number; mealId: number })[]
}

export interface Profile {
  id: number
  tgId: number
  gender: string | null
  age: number | null
  height: number | null
  weight: number | null
  activity: number | null
  goal: string | null
  calorieTarget: number | null
  proteinTarget: number | null
  fatTarget: number | null
  carbTarget: number | null
  notifyEnabled: boolean | null
  notifyHours: number | null
  waterGoalMl: number | null
}

export interface DayReport {
  date: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  count: number
}

export interface PlanMeal {
  type: string
  title: string
  items: FoodItem[]
}
