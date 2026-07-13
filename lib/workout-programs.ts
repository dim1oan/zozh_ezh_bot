/** Готовые программы тренировок на основе каталога упражнений. */

export interface ProgramItem {
  category: string
  exercise: string
}

export interface WorkoutProgram {
  name: string
  description: string
  items: ProgramItem[]
}

export const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    name: "Push — жимовая",
    description: "Грудь, дельты и трицепс в один день",
    items: [
      { category: "Грудь", exercise: "Жим штанги лёжа" },
      { category: "Грудь", exercise: "Жим гантелей на наклонной скамье" },
      { category: "Дельты", exercise: "Жим гантелей сидя" },
      { category: "Дельты", exercise: "Махи гантелями в стороны" },
      { category: "Руки", exercise: "Французский жим лёжа" },
      { category: "Руки", exercise: "Разгибание рук на блоке" },
    ],
  },
  {
    name: "Pull — тяговая",
    description: "Спина и бицепс",
    items: [
      { category: "Спина", exercise: "Подтягивания широким хватом" },
      { category: "Спина", exercise: "Тяга штанги в наклоне" },
      { category: "Спина", exercise: "Тяга верхнего блока" },
      { category: "Спина", exercise: "Гиперэкстензия" },
      { category: "Руки", exercise: "Подъём штанги на бицепс" },
      { category: "Руки", exercise: "Подъём гантелей на бицепс (молот)" },
    ],
  },
  {
    name: "День ног",
    description: "Ноги, ягодицы и голени",
    items: [
      { category: "Ноги", exercise: "Приседания со штангой" },
      { category: "Ноги", exercise: "Жим ногами в тренажёре" },
      { category: "Ягодицы", exercise: "Румынская тяга" },
      { category: "Ягодицы", exercise: "Ягодичный мост со штангой" },
      { category: "Ноги", exercise: "Сгибание ног лёжа" },
      { category: "Голени", exercise: "Подъём на носки стоя" },
    ],
  },
  {
    name: "Фулбоди",
    description: "Всё тело за одну тренировку",
    items: [
      { category: "Ноги", exercise: "Приседания со штангой" },
      { category: "Грудь", exercise: "Жим штанги лёжа" },
      { category: "Спина", exercise: "Тяга штанги в наклоне" },
      { category: "Дельты", exercise: "Жим штанги стоя (армейский)" },
      { category: "Пресс", exercise: "Планка" },
    ],
  },
  {
    name: "Ягодицы и ноги",
    description: "Акцент на низ тела",
    items: [
      { category: "Ягодицы", exercise: "Ягодичный мост со штангой" },
      { category: "Ягодицы", exercise: "Болгарские сплит-приседания" },
      { category: "Ягодицы", exercise: "Приседания сумо" },
      { category: "Ягодицы", exercise: "Отведение ноги в кроссовере" },
      { category: "Ноги", exercise: "Выпады с гантелями" },
      { category: "Голени", exercise: "Подъём на носки сидя" },
    ],
  },
  {
    name: "Пресс и кардио",
    description: "Кор и выносливость",
    items: [
      { category: "Пресс", exercise: "Скручивания лёжа" },
      { category: "Пресс", exercise: "Подъём ног в висе" },
      { category: "Пресс", exercise: "Планка" },
      { category: "Пресс", exercise: "Велосипед" },
      { category: "Кардио", exercise: "HIIT-интервалы" },
    ],
  },
  {
    name: "Домашняя без железа",
    description: "Только собственный вес",
    items: [
      { category: "Грудь", exercise: "Отжимания от пола" },
      { category: "Ноги", exercise: "Приседания с собственным весом" },
      { category: "Пресс", exercise: "Планка" },
      { category: "Пресс", exercise: "Велосипед" },
      { category: "Голени", exercise: "Прыжки на скакалке" },
    ],
  },
]
