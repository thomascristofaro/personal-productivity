import { z } from "zod"

import { CourseSchema } from "@/lib/schemas/course"

export const FREE_TEXT_MAX = 80
export const SERVINGS_MAX = 20

export const MEAL_TYPES = ["LUNCH", "DINNER"] as const

// No custom message: the meal is a hidden field the user never types, so the
// only way to fail this is to call the action directly.
export const MealSchema = z.enum(MEAL_TYPES)
export type Meal = z.infer<typeof MealSchema>

export const DaySchema = z
  .number("Il giorno deve essere un numero.")
  .int("Il giorno deve essere un numero intero.")
  .min(0, "Il giorno non può venire prima di lunedì.")
  .max(6, "Il giorno non può venire dopo domenica.")

export const WeekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La settimana deve essere una data AAAA-MM-GG.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "Questa data non esiste.")
  // A week is named by its Monday. Accepting any other day would let two URLs
  // mean one week, and `Menu.weekStart @unique` cannot catch that because the
  // two dates really are different.
  .refine(
    (date) => date.getUTCDay() === 1,
    "La settimana deve iniziare di lunedì."
  )

// The three fields that address a slot inside its week. One object because none
// of them means anything without the others.
export const SlotAddressSchema = z.object({
  day: DaySchema,
  meal: MealSchema,
  course: CourseSchema,
})

export type SlotAddress = z.infer<typeof SlotAddressSchema>

export const SlotInputSchema = z
  .object({
    recipeId: z.cuid("Questa ricetta non è valida.").nullable(),
    // An empty note is absent, not blank — the same rule the ingredient unit
    // follows, so a slot never holds an empty string nobody can see.
    freeText: z
      .string()
      .trim()
      .max(
        FREE_TEXT_MAX,
        `La nota può avere al massimo ${FREE_TEXT_MAX} caratteri.`
      )
      .nullable()
      .transform((value) => (value === null || value === "" ? null : value)),
    servings: z
      .number("Le porzioni devono essere un numero.")
      .int("Le porzioni devono essere un numero intero.")
      .positive("Le porzioni devono essere più di zero.")
      .max(SERVINGS_MAX, `Le porzioni non possono superare ${SERVINGS_MAX}.`)
      .nullable(),
  })
  // The shopping list reads the recipe and ignores the note, so a slot holding
  // both would shop for a meal the note says you are not cooking.
  .refine((slot) => slot.recipeId === null || slot.freeText === null, {
    message:
      "Uno slot può contenere una ricetta oppure una nota, non entrambe.",
    path: ["freeText"],
  })

export type SlotInput = z.infer<typeof SlotInputSchema>
