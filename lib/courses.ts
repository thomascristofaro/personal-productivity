// The Italian courses of a meal. The order is the order a meal is eaten and the
// order the grid renders; nothing else depends on the positions.
export const COURSES = ["FIRST", "SECOND", "SIDE"] as const

export type Course = (typeof COURSES)[number]

// The only place these three words exist. Italian, because the user reads them.
export const COURSE_LABELS: Record<Course, string> = {
  FIRST: "Primo",
  SECOND: "Secondo",
  SIDE: "Contorno",
}

export function courseRank(course: Course): number {
  return COURSES.indexOf(course)
}
