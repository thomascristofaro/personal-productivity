import { db } from "@/lib/db"
import { env } from "@/lib/env"
import {
  definitionFor,
  LLM_FUNCTIONS,
  type LlmFunctionDefinition,
} from "@/lib/llm-functions"
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
 * The settings a function runs with when nothing has been tuned.
 *
 * @param definition The function as the code declares it.
 * @returns The compiled-in defaults, with the first configured model.
 */
export function defaultsFor(definition: LlmFunctionDefinition): LlmSettings {
  return {
    prompt: definition.prompt,
    model: env.GEMINI_MODELS[0],
    temperature: definition.temperature,
    maxTokens: definition.maxTokens,
    reasoning: definition.reasoning,
  }
}

/**
 * The settings a function should run with.
 *
 * Falls back to the definition when the row is absent rather than throwing: the
 * table ships empty, and an unseeded database must not take the feature down —
 * design document 2026-08-21 section 7.2.
 *
 * @param id The function id.
 * @returns The stored settings, or the compiled-in defaults.
 * @throws Error when no function with that id exists in the code.
 */
export async function getSettings(id: string): Promise<LlmSettings> {
  const definition = definitionFor(id)
  if (definition === null) throw new Error(`Unknown LLM function: ${id}`)

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

  return row ?? defaultsFor(definition)
}

/**
 * Writes a function's settings, creating the row the first time it is tuned.
 *
 * An upsert rather than an update: the row does not exist until someone saves,
 * so the first save on a fresh database is a create. `name` and `description`
 * come from the definition and are never taken from the form — they describe
 * the feature, not its tuning.
 *
 * @param id The function id.
 * @param input The validated settings.
 * @returns Nothing.
 * @throws Error when no function with that id exists in the code.
 */
export async function updateFunction(
  id: string,
  input: LlmFunctionInput
): Promise<void> {
  const definition = definitionFor(id)
  if (definition === null) throw new Error(`Unknown LLM function: ${id}`)

  await db.llmFunction.upsert({
    where: { id },
    update: input,
    create: {
      id,
      name: definition.name,
      description: definition.description,
      ...input,
    },
  })
}

// `LlmExecution.functionId` is a foreign key, so a history row cannot exist
// before the function row does — and the function row is only written when
// someone saves the settings. Generating before ever visiting that screen
// therefore wrote a menu and lost its execution to a constraint violation.
// Creating the row here, with the defaults it was actually run with, keeps the
// key and the cascade: deleting a function still takes its history with it.
async function ensureRow(id: string): Promise<void> {
  const definition = definitionFor(id)
  if (definition === null) throw new Error(`Unknown LLM function: ${id}`)

  await db.llmFunction.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: definition.name,
      description: definition.description,
      ...defaultsFor(definition),
    },
  })
}

/**
 * Records one call and prunes the history back to the retention ceiling.
 *
 * Creates the function row first when it is missing: the history has a foreign
 * key to it, and the row is otherwise only written by a save on the settings
 * screen.
 *
 * @param record What the call was and what it did.
 * @returns Nothing.
 * @throws Error when no function with that id exists in the code.
 */
export async function recordExecution(record: ExecutionRecord): Promise<void> {
  await ensureRow(record.functionId)
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
 * Every function the application has, for the list screen.
 *
 * Driven by the code rather than by the table: a function nobody has tuned yet
 * has no row, and must still be listed and openable. The row only supplies the
 * model once it exists.
 *
 * @returns The functions, by name.
 */
export async function listFunctions() {
  const rows = await db.llmFunction.findMany({
    select: { id: true, model: true },
  })
  const models = new Map(rows.map((row) => [row.id, row.model]))

  return LLM_FUNCTIONS.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    model: models.get(definition.id) ?? env.GEMINI_MODELS[0],
  })).sort((a, b) => a.name.localeCompare(b.name, "it"))
}

/**
 * One function, as the detail screen needs it.
 *
 * The name and description always come from the definition; the settings come
 * from the row when there is one and from the defaults when there is not. The
 * screen is therefore usable before anything has ever been saved.
 *
 * @param id The function id.
 * @returns The function, or null when no such function exists in the code.
 */
export async function getFunction(id: string) {
  const definition = definitionFor(id)
  if (definition === null) return null

  const settings = await getSettings(id)

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    ...settings,
  }
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
 * Scoped to its function: the id alone would render one function's run under
 * another function's route instead of answering 404.
 *
 * @param functionId The function the execution must belong to.
 * @param runId The execution id.
 * @returns The row, or null when it does not exist or belongs elsewhere.
 */
export async function getExecution(functionId: string, runId: string) {
  return db.llmExecution.findFirst({ where: { id: runId, functionId } })
}
