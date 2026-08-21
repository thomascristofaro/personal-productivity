import { db } from "@/lib/db"
import type { LlmFunctionInput } from "@/lib/schemas/llm-function"

/** Design document 2026-08-21 section 7.3. Bounded so nothing has to be
 * decided later about what to discard. */
export const EXECUTION_RETENTION = 20

export type LlmSettings = {
  prompt: string
  model: string
  temperature: number
  maxTokens: number
  reasoning: string
}

export type ExecutionRecord = {
  functionId: string
  prompt: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  output: string | null
  error: string | null
}

/**
 * Which executions are surplus, given the history newest-first.
 *
 * @param ids Execution ids, most recent first.
 * @param keep How many to retain.
 * @returns The ids to delete, empty when the history is within the ceiling.
 */
export function idsToPrune(ids: string[], keep: number): string[] {
  return ids.slice(keep)
}

/**
 * The settings a function should run with.
 *
 * Falls back to the caller's defaults when the row is absent rather than
 * throwing: the table ships empty, and an unseeded database must not take the
 * feature down — design document 2026-08-21 section 7.2.
 *
 * @param id The function id.
 * @param fallback The defaults compiled into the application.
 * @returns The stored settings, or the fallback.
 */
export async function getSettings(
  id: string,
  fallback: LlmSettings
): Promise<LlmSettings> {
  const row = await db.llmFunction.findUnique({
    where: { id },
    select: {
      prompt: true,
      model: true,
      temperature: true,
      maxTokens: true,
      reasoning: true,
    },
  })

  return row ?? fallback
}

/**
 * Writes a function's settings.
 *
 * @param id The function id.
 * @param input The validated settings.
 * @returns Nothing.
 */
export async function updateFunction(
  id: string,
  input: LlmFunctionInput
): Promise<void> {
  await db.llmFunction.update({ where: { id }, data: input })
}

/**
 * Records one call and prunes the history back to the retention ceiling.
 *
 * @param record What the call was and what it did.
 * @returns Nothing.
 */
export async function recordExecution(record: ExecutionRecord): Promise<void> {
  await db.llmExecution.create({ data: record })

  const ids = await db.llmExecution.findMany({
    where: { functionId: record.functionId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const surplus = idsToPrune(
    ids.map((row) => row.id),
    EXECUTION_RETENTION
  )

  if (surplus.length > 0) {
    await db.llmExecution.deleteMany({ where: { id: { in: surplus } } })
  }
}

/**
 * Every registered function, for the list screen.
 *
 * @returns The functions, by name.
 */
export async function listFunctions() {
  return db.llmFunction.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      model: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  })
}

/**
 * One function's full settings.
 *
 * @param id The function id.
 * @returns The row, or null when there is none.
 */
export async function getFunction(id: string) {
  return db.llmFunction.findUnique({ where: { id } })
}

/**
 * The retained executions of a function, most recent first.
 *
 * @param functionId The function id.
 * @returns Up to `EXECUTION_RETENTION` rows, without the bulky text columns.
 */
export async function listExecutions(functionId: string) {
  return db.llmExecution.findMany({
    where: { functionId },
    orderBy: { createdAt: "desc" },
    take: EXECUTION_RETENTION,
    select: {
      id: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      durationMs: true,
      error: true,
      createdAt: true,
    },
  })
}

/**
 * One execution, with the prompt and the output it carried.
 *
 * @param runId The execution id.
 * @returns The row, or null.
 */
export async function getExecution(runId: string) {
  return db.llmExecution.findUnique({ where: { id: runId } })
}
