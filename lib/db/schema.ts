import { bigint, boolean, date, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tgId: bigint("tg_id", { mode: "number" }).notNull().unique(),
  gender: text("gender"),
  age: integer("age"),
  height: real("height"),
  weight: real("weight"),
  activity: real("activity"),
  goal: text("goal"),
  calorieTarget: real("calorie_target"),
  proteinTarget: real("protein_target"),
  fatTarget: real("fat_target"),
  carbTarget: real("carb_target"),
  paidUntil: timestamp("paid_until", { withTimezone: true }),
  notifyEnabled: boolean("notify_enabled").default(true),
  notifyHours: integer("notify_hours").default(6),
  waterGoalMl: real("water_goal_ml"),
  lastActive: timestamp("last_active", { withTimezone: true }),
  lastNotified: timestamp("last_notified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mealType: text("meal_type").notNull(),
  rawText: text("raw_text"),
  eatenAt: timestamp("eaten_at", { withTimezone: true }).defaultNow(),
  totalKcal: real("total_kcal"),
  totalProtein: real("total_protein"),
  totalFat: real("total_fat"),
  totalCarbs: real("total_carbs"),
})

export const mealItems = pgTable("meal_items", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id").notNull(),
  name: text("name").notNull(),
  grams: real("grams").default(0),
  kcal: real("kcal").default(0),
  protein: real("protein").default(0),
  fat: real("fat").default(0),
  carbs: real("carbs").default(0),
})

export const waterLog = pgTable("water_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amountMl: real("amount_ml").notNull(),
  drunkAt: timestamp("drunk_at", { withTimezone: true }).defaultNow(),
})

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(),
  exercise: text("exercise").notNull(),
  note: text("note"),
  weightKg: real("weight_kg"),
  doneAt: timestamp("done_at", { withTimezone: true }).defaultNow(),
})

export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionDate: date("session_date").notNull(),
  durationMin: integer("duration_min"),
})

export const sleepLog = pgTable("sleep_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sleepDate: date("sleep_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMin: integer("duration_min").notNull(),
  dream: text("dream"),
})

// user_id здесь — Telegram ID (как и в боте)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  amount: text("amount"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
