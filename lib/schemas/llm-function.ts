import { z } from "zod"

/** What the settings screen may change about a function. */
export const LlmFunctionInputSchema = z.object({
  prompt: z.string().trim().min(1, "Il prompt non può essere vuoto."),
  model: z.string().trim().min(1, "Indica un modello."),
  temperature: z
    .number("La temperatura deve essere un numero.")
    .min(0, "La temperatura va da 0 a 2.")
    .max(2, "La temperatura va da 0 a 2."),
  maxTokens: z
    .number("Il limite di token deve essere un numero.")
    .int("Il limite di token deve essere un numero intero.")
    .min(1, "Il limite di token deve essere almeno 1."),
})

export type LlmFunctionInput = z.infer<typeof LlmFunctionInputSchema>
