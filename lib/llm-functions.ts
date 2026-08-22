import { MENU_PROPOSAL_PROMPT } from "@/lib/prompts/menu-proposal"

/**
 * An LLM-backed feature, as the application knows it.
 *
 * The code is the register of which functions exist; the database holds only
 * what has been tuned away from these defaults. A function therefore appears on
 * the settings screen from the moment it is written, on any database, seeded or
 * not — which is what design document 2026-08-21 section 7.2 asks of the
 * service, extended to the screen that edits it.
 *
 * No environment variable is read here, so `prisma/seed.ts` can import this
 * file: `lib/env.ts` is server-only and validates far more than a seed needs.
 * The default model is the first of `GEMINI_MODELS` and is applied by
 * `defaultsFor` in the registry service.
 */
export type LlmFunctionDefinition = {
  id: string
  name: string
  description: string
  prompt: string
  temperature: number
  maxTokens: number
  reasoning: string
}

export const LLM_FUNCTIONS: readonly LlmFunctionDefinition[] = [
  {
    id: "menu-proposal",
    name: "Generazione menù",
    description:
      "Compone i quattordici pasti della settimana scegliendo fra le ricette disponibili.",
    prompt: MENU_PROPOSAL_PROMPT,
    temperature: 1,
    maxTokens: 4096,
    reasoning: "provider-default",
  },
]

/**
 * The definition of one function.
 *
 * @param id The function id.
 * @returns The definition, or null when no such function exists in the code.
 */
export function definitionFor(id: string): LlmFunctionDefinition | null {
  return LLM_FUNCTIONS.find((fn) => fn.id === id) ?? null
}
