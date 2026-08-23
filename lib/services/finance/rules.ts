import { db } from "@/lib/db"
import type { RuleInput, RuleKind } from "@/lib/schemas/finance"
import type { MatchableRule } from "@/lib/services/finance/categorise"

export type RuleSummary = {
  id: string
  kind: RuleKind
  pattern: string
  categoryId: string
  categoryName: string
  accountId: string | null
  accountName: string | null
  priority: number
}

/**
 * Every rule, in the order they are tried.
 *
 * @returns the rules, lowest priority first
 */
export async function listRules(): Promise<RuleSummary[]> {
  const rows = await db.categoryRule.findMany({
    select: {
      id: true,
      kind: true,
      pattern: true,
      priority: true,
      categoryId: true,
      category: { select: { name: true } },
      accountId: true,
      account: { select: { name: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    pattern: row.pattern,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    priority: row.priority,
  }))
}

/**
 * The rules in the shape the matcher wants.
 *
 * A separate read from listRules so the matcher never depends on what a screen
 * happens to display.
 *
 * @returns every rule, unordered — categorise() sorts them itself
 */
export async function matchableRules(): Promise<MatchableRule[]> {
  return db.categoryRule.findMany({
    select: {
      id: true,
      kind: true,
      pattern: true,
      categoryId: true,
      priority: true,
      accountId: true,
    },
  })
}

/**
 * Writes a rule, ahead of every rule written before it.
 *
 * New rules go first because the owner writes one looking at a movement the
 * existing rules got wrong or missed. Sorting them last would mean the general
 * rule that already claimed it keeps winning.
 *
 * @param input - the validated form
 * @returns the new rule's id
 */
export async function createRule(input: RuleInput): Promise<string> {
  const first = await db.categoryRule.findFirst({
    select: { priority: true },
    orderBy: { priority: "asc" },
  })

  const created = await db.categoryRule.create({
    data: { ...input, priority: (first?.priority ?? 0) - 1 },
    select: { id: true },
  })

  return created.id
}

/**
 * Removes a rule. The movements it categorised keep their category.
 *
 * @param id - the rule's id
 * @returns nothing
 */
export async function deleteRule(id: string): Promise<void> {
  // deleteMany: an id that is already gone is a second tap, not an error.
  await db.categoryRule.deleteMany({ where: { id } })
}

/**
 * Moves a rule one place earlier or later in the order.
 *
 * Swaps the two priorities rather than renumbering the list, so two people
 * reordering at once cannot collapse it.
 *
 * @param id - the rule to move
 * @param direction - "up" to try it sooner, "down" to try it later
 * @returns nothing
 */
export async function moveRule(
  id: string,
  direction: "up" | "down"
): Promise<void> {
  const rules = await db.categoryRule.findMany({
    select: { id: true, priority: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })

  const at = rules.findIndex((rule) => rule.id === id)
  const a = rules[at]
  const b = rules[direction === "up" ? at - 1 : at + 1]

  if (a === undefined || b === undefined) return

  // Two rules created in the same second can share a priority, and swapping
  // equal numbers would move nothing. Nudging one of them apart keeps the tap
  // meaning something.
  const [first, second] =
    a.priority === b.priority
      ? direction === "up"
        ? [a.priority - 1, b.priority]
        : [a.priority + 1, b.priority]
      : [b.priority, a.priority]

  await db.$transaction([
    db.categoryRule.update({ where: { id: a.id }, data: { priority: first } }),
    db.categoryRule.update({ where: { id: b.id }, data: { priority: second } }),
  ])
}
