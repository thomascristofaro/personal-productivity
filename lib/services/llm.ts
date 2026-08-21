import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, Output } from "ai"

import { env } from "@/lib/env"
import {
  menuProposalSchema,
  type MenuProposal,
} from "@/lib/schemas/menu-proposal"

export type LlmProposalInput = {
  instructions: string
  request: string
  candidateCount: number
  model: string
  temperature: number
  maxTokens: number
}

export type LlmProposalResult = {
  proposal: MenuProposal
  inputTokens: number
  outputTokens: number
  // What the model actually said. By the time it is parsed this is gone, and
  // it is what the execution history stores.
  raw: string
}

/** The model was unreachable, too slow, or answered something unusable. */
export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "LlmError"
  }
}

// The SDK looks for GOOGLE_GENERATIVE_AI_API_KEY on its own. This project names
// the variable GOOGLE_AI_API_KEY, so the provider is handed the key rather than
// left to go looking for one it will not find. The model is not read here: the
// caller knows about the registry and this file deliberately does not.
const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })

const TIMEOUT_MS = 60_000

/**
 * Asks the model for a menu proposal.
 *
 * The single point in the application where an LLM SDK is imported, so the
 * provider stays replaceable — ESLint enforces that, and design document
 * 2026-08-21 section 3 explains why the boundary rather than the library is
 * what makes it reversible.
 *
 * The schema is built per call because it bounds the candidate index by the
 * number of candidates actually sent.
 *
 * @param input The instructions, the per-request data, and how many candidates
 * were numbered in it.
 * @returns The parsed proposal and what the call cost in tokens.
 * @throws LlmError When the call fails, times out, or the answer does not
 * satisfy the schema.
 */
export async function callMenuProposal(
  input: LlmProposalInput
): Promise<LlmProposalResult> {
  try {
    const result = await generateText({
      model: google(input.model),
      system: input.instructions,
      prompt: input.request,
      temperature: input.temperature,
      maxOutputTokens: input.maxTokens,
      output: Output.object({
        schema: menuProposalSchema(input.candidateCount),
      }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })

    return {
      proposal: result.output,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      raw: result.text,
    }
  } catch (cause) {
    throw new LlmError("La generazione del menù non è riuscita.", { cause })
  }
}
