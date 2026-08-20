// The state every form action returns. Deliberately importless — a client
// component reads this type, and anything imported here reaches the browser
// bundle with it.
export type FormState = {
  ok: boolean
  message: string | null
  // Present even on forms that show no per-field error. One shape avoids the
  // question "which state type does this form use", which is the friction this
  // module exists to remove.
  errors: Record<string, string[]>
  values: Record<string, string>
}

export type FormAction = (
  state: FormState,
  formData: FormData
) => Promise<FormState>

export const EMPTY_FORM_STATE: FormState = {
  ok: false,
  message: null,
  errors: {},
  values: {},
}

/**
 * A refused submit, with what the user typed so the form can put it back.
 *
 * @param message - what to tell the user, in Italian
 * @param parts - per-field errors and the echoed values
 * @returns a state whose `ok` is false
 */
export function failure(
  message: string,
  parts: {
    errors?: Record<string, string[]>
    values?: Record<string, string>
  } = {}
): FormState {
  return {
    ok: false,
    message,
    errors: parts.errors ?? {},
    values: parts.values ?? {},
  }
}

/**
 * A submit that worked.
 *
 * Only read by screens that stay open — an action that redirects never returns.
 *
 * @param message - an optional note to show afterwards
 * @returns a state whose `ok` is true
 */
export function success(message: string | null = null): FormState {
  return { ok: true, message, errors: {}, values: {} }
}
