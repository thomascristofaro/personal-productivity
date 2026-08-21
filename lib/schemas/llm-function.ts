import { z } from "zod"

/**
 * The AI SDK's normalised reasoning scale. Standard across providers: the
 * core translates it into Google's thinkingLevel, Anthropic's budget_tokens
 * and so on, so nothing here is provider-specific.
 */
export const REASONING_LEVELS = {
  "provider-default": "Predefinito del modello",
  none: "Disattivato",
  minimal: "Minimo",
  low: "Basso",
  medium: "Medio",
  high: "Alto",
  xhigh: "Massimo",
} as const

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
  reasoning: z.enum(
    Object.keys(REASONING_LEVELS) as [string, ...string[]],
    "Livello di ragionamento non valido."
  ),
})

export type LlmFunctionInput = z.infer<typeof LlmFunctionInputSchema>
