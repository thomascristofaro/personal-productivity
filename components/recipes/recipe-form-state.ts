export type RecipeFormState = {
  errors: Record<string, string[]>
  message: string | null
  // The submitted field values, echoed back on every failure so the form can
  // render them as `defaultValue` before React 19's unconditional
  // `requestFormReset` restores the DOM to whatever `defaultValue` says. A flat
  // string map rather than `Partial<RecipeFormValues>`: it mirrors the raw
  // `FormData` the action already reads, with no numeric coercion to undo when
  // echoing a field the user may have mistyped.
  values: Record<string, string> | null
}

export const EMPTY_FORM_STATE: RecipeFormState = {
  errors: {},
  message: null,
  values: null,
}

export type SaveRecipeAction = (
  state: RecipeFormState,
  formData: FormData
) => Promise<RecipeFormState>
