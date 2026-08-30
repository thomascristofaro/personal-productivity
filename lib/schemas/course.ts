import { z } from "zod"

import { COURSES } from "@/lib/courses"

// Carries a message, unlike MealSchema: the meal is a hidden field nobody ever
// types, but the course is a control the form leaves unset until it is chosen,
// so this message is one the user can actually reach.
export const CourseSchema = z.enum(
  COURSES,
  "Scegli se è un primo, un secondo o un contorno."
)
