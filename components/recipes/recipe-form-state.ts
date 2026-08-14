export type RecipeFormState = {
  errors: Record<string, string[]>
  message: string | null
}

export const EMPTY_FORM_STATE: RecipeFormState = { errors: {}, message: null }

export type SaveRecipeAction = (
  state: RecipeFormState,
  formData: FormData
) => Promise<RecipeFormState>
