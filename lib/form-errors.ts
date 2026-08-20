import type { ZodError } from "zod"

/**
 * Groups a Zod error's messages by the field they belong to.
 *
 * Built from `issues` rather than a version-specific flatten helper. A nested
 * path keys under its first segment, so an issue inside an ingredient row
 * reaches the one message the recipe form renders for the whole block.
 *
 * @param error - the error from a failed `safeParse`
 * @returns field name to its messages; an issue naming no field is dropped
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== "string") continue
    errors[field] = [...(errors[field] ?? []), issue.message]
  }

  return errors
}

/**
 * Echoes exactly what was submitted.
 *
 * React 19 resets an uncontrolled form to its `defaultValue`s before the action
 * runs, so a refused save loses what was typed unless it comes back in the
 * state.
 *
 * @param formData - the submitted form
 * @param fields - the field names to echo
 * @returns every named field as a string; anything absent or non-string as ""
 */
export function valuesFrom(
  formData: FormData,
  fields: readonly string[]
): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of fields) {
    const value = formData.get(field)
    values[field] = typeof value === "string" ? value : ""
  }

  return values
}
