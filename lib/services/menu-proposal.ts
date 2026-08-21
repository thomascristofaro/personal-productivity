import { HOUSEHOLD_SERVINGS, RECENCY_WINDOW_WEEKS } from "@/lib/config"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import {
  buildMenuProposalRequest,
  MENU_PROPOSAL_PROMPT,
} from "@/lib/prompts/menu-proposal"
import type { MenuProposal } from "@/lib/schemas/menu-proposal"

import { callMenuProposal, LlmError, type LlmProposalResult } from "./llm"
import { getSettings, recordExecution } from "./llm-registry"
import {
  buildCandidateLines,
  indexCandidates,
  type CandidateRecipe,
} from "./menu-candidates"

export type ProposedMenuSlot = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string
}

/** The model put the same recipe in the week twice. */
export class DuplicateProposalError extends Error {
  constructor() {
    super("Il menù proposto ripete una ricetta nella stessa settimana.")
    this.name = "DuplicateProposalError"
  }
}

/** There is nothing to choose from. */
export class NoCandidatesError extends Error {
  constructor() {
    super("Non ci sono ricette fra cui scegliere.")
    this.name = "NoCandidatesError"
  }
}

const MS_PER_DAY = 86_400_000

/** The registry row this service reads its prompt and model from. */
const FUNCTION_ID = "menu-proposal"

/**
 * Turns the model's integer answer into slots, refusing anything that breaks
 * the one rule the prompt is not trusted with.
 *
 * @param proposal The parsed response.
 * @param byNumber The number-to-id map the prompt was numbered against.
 * @returns One entry per filled slot; empty slots are dropped.
 * @throws DuplicateProposalError When a recipe appears more than once.
 */
export function resolveProposal(
  proposal: MenuProposal,
  byNumber: Map<number, string>
): ProposedMenuSlot[] {
  const slots: ProposedMenuSlot[] = []
  const used = new Set<string>()

  for (const slot of proposal.slots) {
    if (slot.candidate === null) continue

    const recipeId = byNumber.get(slot.candidate)
    if (recipeId === undefined) {
      throw new Error(`Candidate ${slot.candidate} is not in the index.`)
    }

    if (used.has(recipeId)) throw new DuplicateProposalError()
    used.add(recipeId)

    slots.push({ day: slot.day, meal: slot.meal, recipeId })
  }

  return slots
}

async function loadCandidates(weekStart: Date): Promise<CandidateRecipe[]> {
  const since = new Date(
    weekStart.getTime() - RECENCY_WINDOW_WEEKS * 7 * MS_PER_DAY
  )

  const [recipes, pastSlots] = await Promise.all([
    db.recipe.findMany({
      select: {
        id: true,
        title: true,
        totalMinutes: true,
        tags: true,
        ingredients: {
          select: { ingredientName: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { title: "asc" },
    }),
    db.menuSlot.findMany({
      where: {
        recipeId: { not: null },
        menu: { weekStart: { gte: since, lt: weekStart } },
      },
      select: {
        recipeId: true,
        day: true,
        menu: { select: { weekStart: true } },
      },
    }),
  ])

  // A slot that appeared in a past week counts as cooked — design document
  // 2026-08-21 section 6 takes that proxy knowingly. The day within the week is
  // added back so two recipes from the same week do not read as equally recent.
  const lastCooked = new Map<string, number>()
  for (const slot of pastSlots) {
    if (slot.recipeId === null) continue
    const cookedAt = slot.menu.weekStart.getTime() + slot.day * MS_PER_DAY
    const previous = lastCooked.get(slot.recipeId)
    if (previous === undefined || cookedAt > previous) {
      lastCooked.set(slot.recipeId, cookedAt)
    }
  }

  return recipes.map((recipe) => {
    const cookedAt = lastCooked.get(recipe.id)

    return {
      id: recipe.id,
      title: recipe.title,
      totalMinutes: recipe.totalMinutes,
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((row) => row.ingredientName),
      lastCookedDaysAgo:
        cookedAt === undefined
          ? null
          : Math.floor((weekStart.getTime() - cookedAt) / MS_PER_DAY),
    }
  })
}

/**
 * Proposes a week of meals for the given week.
 *
 * Decides nothing about persistence: the caller writes the slots, and the grid
 * stays the source of truth with the proposal only pre-filling it.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns One entry per proposed slot, empty slots omitted.
 * @throws NoCandidatesError When the recipe book is empty.
 * @throws LlmError When the model is unreachable or answers unusably.
 * @throws DuplicateProposalError When the answer repeats a recipe.
 */
export async function proposeMenu(
  weekStart: Date
): Promise<ProposedMenuSlot[]> {
  const candidates = await loadCandidates(weekStart)
  if (candidates.length === 0) throw new NoCandidatesError()

  const index = indexCandidates(candidates)
  const month = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    timeZone: "UTC",
  }).format(weekStart)

  // The file is the fallback, not a leftover: an unseeded table must not take
  // generation down — design document 2026-08-21 section 7.2.
  const settings = await getSettings(FUNCTION_ID, {
    prompt: MENU_PROPOSAL_PROMPT,
    model: env.GEMINI_MODEL,
    temperature: 1,
    maxTokens: 4096,
  })

  const request = buildMenuProposalRequest({
    candidates: buildCandidateLines(candidates),
    month,
    servings: HOUSEHOLD_SERVINGS,
    filled: "Tutti gli slot sono liberi.",
  })

  const startedAt = Date.now()
  let result: LlmProposalResult | undefined
  let failure: unknown

  try {
    result = await callMenuProposal({
      instructions: settings.prompt,
      request,
      candidateCount: index.count,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    })
  } catch (error) {
    failure = error
  }

  // Bookkeeping must never fail a generation: history is diagnostics, and
  // losing a row must not lose a menu.
  await recordExecution({
    functionId: FUNCTION_ID,
    prompt: settings.prompt,
    model: settings.model,
    inputTokens: result?.inputTokens ?? null,
    outputTokens: result?.outputTokens ?? null,
    durationMs: Date.now() - startedAt,
    output: result?.raw ?? null,
    error: failure instanceof Error ? failure.message : null,
  }).catch(() => {})

  if (failure !== undefined) throw failure

  return resolveProposal(result!.proposal, index.byNumber)
}

export { LlmError }
