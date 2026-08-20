"use client"

import { useActionState, useEffect } from "react"

import { useAttempt } from "@/hooks/use-attempt"
import { EMPTY_FORM_STATE, type FormAction } from "@/lib/form"

export type FieldProps = {
  id: string
  name: string
  defaultValue: string
  "aria-invalid"?: true
  "aria-describedby"?: string
}

/**
 * Everything a form needs from its action, in one call.
 *
 * @param action - the server action, typed as FormAction
 * @param fieldOrder - DOM order of the flat fields, so the first invalid one can
 *   take focus. Must be a module-level constant: a fresh array on every render
 *   would re-run the focus effect.
 * @param initialValues - what the server sent, used when the state carries nothing
 * @returns the action state, the pending flag, the remount counter, and the
 *   per-field helpers
 */
export function useFormState(
  action: FormAction,
  fieldOrder: readonly string[],
  initialValues: Record<string, string> = {}
) {
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_FORM_STATE
  )
  const attempt = useAttempt(state)

  useEffect(() => {
    const firstInvalid = fieldOrder.find((field) => state.errors[field]?.length)
    if (firstInvalid !== undefined) {
      document.getElementById(firstInvalid)?.focus()
    }
  }, [state, fieldOrder])

  const errorOf = (field: string) => state.errors[field]?.[0]

  // DOM attributes only. The error *text* is not here on purpose: it would land
  // on the element as an unknown attribute. Field components take it as a prop.
  const fieldProps = (
    field: string,
    options: { described?: boolean } = {}
  ): FieldProps => {
    const ids = [
      options.described ? `${field}-description` : null,
      errorOf(field) ? `${field}-error` : null,
    ].filter((id) => id !== null)

    return {
      id: field,
      name: field,
      // The echoed value wins over the server's: after a refusal it is what the
      // user typed, and on a fresh render there is none.
      defaultValue: state.values[field] ?? initialValues[field] ?? "",
      "aria-invalid": errorOf(field) ? true : undefined,
      "aria-describedby": ids.length === 0 ? undefined : ids.join(" "),
    }
  }

  return { state, formAction, isPending, attempt, errorOf, fieldProps }
}
