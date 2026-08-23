import { db } from "@/lib/db"
import { visibleTo } from "@/lib/services/finance/access"
import { categorise } from "@/lib/services/finance/categorise"
import { matchableRules } from "@/lib/services/finance/rules"

const SELECTION = {
  id: true,
  accountId: true,
  description: true,
  providerCategory: true,
} as const

type Assignable = {
  id: string
  accountId: string
  description: string
  providerCategory: string | null
}

// One movement, one update. A CASE expression over the whole set would be one
// round trip instead of a few hundred, and this runs after an import or on a
// tap — neither is a hot path, and the loop is the version anyone can read.
async function assign(rows: readonly Assignable[]): Promise<number> {
  const rules = await matchableRules()
  if (rules.length === 0) return 0

  let changed = 0

  for (const row of rows) {
    const match = categorise(rules, row)
    if (match === null) continue

    await db.movement.update({
      where: { id: row.id },
      data: { categoryId: match.categoryId, categorySource: match.source },
    })
    changed++
  }

  return changed
}

/**
 * Runs the rules over movements that have just arrived.
 *
 * Called by the import, which has already authorised the account.
 *
 * @param movementIds - the rows the import wrote
 * @returns how many took a category
 */
export async function applyRulesTo(
  movementIds: readonly string[]
): Promise<number> {
  if (movementIds.length === 0) return 0

  const rows = await db.movement.findMany({
    where: { id: { in: [...movementIds] } },
    select: SELECTION,
  })

  return assign(rows)
}

/**
 * Runs the rules over the movements already stored.
 *
 * Touches only what nobody decided by hand: `MANUAL` and `TRANSFER_LINK` rows
 * are left alone, because a rule may improve a guess and may not overrule a
 * decision. This is what makes "apply it backwards too" safe to say yes to.
 *
 * Never runs by itself — on import, or when the owner asks. A history that
 * changed under someone who changed nothing is worse than one that is out of
 * date.
 *
 * @param actorId - the user id, from the session
 * @returns how many movements changed
 */
export async function applyRulesToPast(actorId: string): Promise<number> {
  const rows = await db.movement.findMany({
    where: {
      account: visibleTo(actorId),
      categorySource: { in: ["NONE", "RULE", "PROVIDER_MAP"] },
    },
    select: SELECTION,
  })

  return assign(rows)
}

/**
 * How many movements still have no category.
 *
 * The number the summary shows as work to do.
 *
 * @param actorId - the user id, from the session
 * @returns the count over the accounts the user can see
 */
export async function countUncategorised(actorId: string): Promise<number> {
  return db.movement.count({
    where: { account: visibleTo(actorId), categoryId: null },
  })
}
