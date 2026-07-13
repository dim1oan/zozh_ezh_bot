/** Каталог групп мышц и упражнений для быстрого добавления тренировок. */

export const WORKOUT_CATEGORIES = [
  "Дельты",
  "Грудь",
  "Руки",
  "Пресс",
  "Спина",
  "Ноги",
  "Ягодицы",
  "Голени",
  "Кардио",
] as const

export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number]

export interface ExerciseDef {
  name: string
  /** Предусмотрен ли рабочий вес (штанга, гантели, блок) */
  weighted: boolean
}

export const EXERCISES: Record<WorkoutCategory, ExerciseDef[]> = {
  Дельты: [
    { name: "Жим гантелей сидя", weighted: true },
    { name: "Жим штанги стоя (армейский)", weighted: true },
    { name: "Махи гантелями в стороны", weighted: true },
    { name: "Махи гантелями в наклоне", weighted: true },
    { name: "Тяга штанги к подбородку", weighted: true },
    { name: "Подъём гантелей перед собой", weighted: true },
  ],
  Грудь: [
    { name: "Жим штанги лёжа", weighted: true },
    { name: "Жим гантелей на наклонной скамье", weighted: true },
    { name: "Разводка гантелей лёжа", weighted: true },
    { name: "Отжимания от пола", weighted: false },
    { name: "Отжимания на брусьях", weighted: false },
    { name: "Сведение рук в кроссовере", weighted: true },
  ],
  Руки: [
    { name: "Подъём штанги на бицепс", weighted: true },
    { name: "Подъём гантелей на бицепс (молот)", weighted: true },
    { name: "Французский жим лёжа", weighted: true },
    { name: "Разгибание рук на блоке", weighted: true },
    { name: "Подтягивания обратным хватом", weighted: false },
    { name: "Отжимания узким хватом", weighted: false },
  ],
  Пресс: [
    { name: "Скручивания лёжа", weighted: false },
    { name: "Подъём ног в висе", weighted: false },
    { name: "Планка", weighted: false },
    { name: "Боковая планка", weighted: false },
    { name: "Велосипед", weighted: false },
    { name: "Скручивания на римском стуле", weighted: false },
  ],
  Спина: [
    { name: "Подтягивания широким хватом", weighted: false },
    { name: "Тяга штанги в наклоне", weighted: true },
    { name: "Тяга верхнего блока", weighted: true },
    { name: "Тяга гантели одной рукой", weighted: true },
    { name: "Становая тяга", weighted: true },
    { name: "Гиперэкстензия", weighted: false },
  ],
  Ноги: [
    { name: "Приседания со штангой", weighted: true },
    { name: "Жим ногами в тренажёре", weighted: true },
    { name: "Выпады с гантелями", weighted: true },
    { name: "Разгибание ног в тренажёре", weighted: true },
    { name: "Сгибание ног лёжа", weighted: true },
    { name: "Приседания с собственным весом", weighted: false },
  ],
  Ягодицы: [
    { name: "Ягодичный мост со штангой", weighted: true },
    { name: "Румынская тяга", weighted: true },
    { name: "Болгарские сплит-приседания", weighted: true },
    { name: "Отведение ноги в кроссовере", weighted: true },
    { name: "Зашагивания на платформу", weighted: true },
    { name: "Приседания сумо", weighted: true },
  ],
  Голени: [
    { name: "Подъём на носки стоя", weighted: true },
    { name: "Подъём на носки сидя", weighted: true },
    { name: "Подъём на носки в тренажёре", weighted: true },
    { name: "Прыжки на скакалке", weighted: false },
  ],
  Кардио: [
    { name: "Бег (дорожка / улица)", weighted: false },
    { name: "Велотренажёр", weighted: false },
    { name: "Эллипс", weighted: false },
    { name: "Ходьба в горку", weighted: false },
    { name: "Скакалка", weighted: false },
    { name: "Гребной тренажёр", weighted: false },
    { name: "Плавание", weighted: false },
    { name: "HIIT-интервалы", weighted: false },
  ],
}

/** Проверяет, предусмотрен ли вес для упражнения из каталога. */
export function isWeighted(category: string, exercise: string): boolean {
  const list = EXERCISES[category as WorkoutCategory]
  return list?.find((e) => e.name === exercise)?.weighted ?? false
}
