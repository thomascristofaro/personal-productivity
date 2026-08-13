// Where an ingredient goes when nothing has been learned about it yet. The user
// assigns a real aisle once and it is remembered from then on.
export const AISLE_UNKNOWN = "altro"

// Walking order through the shop, not alphabetical order. Reorder this to match
// the supermarket actually used; nothing else depends on the positions.
export const AISLE_ORDER = [
  "ortofrutta",
  "panetteria",
  "macelleria",
  "pescheria",
  "salumi e formaggi",
  "banco frigo",
  "surgelati",
  "dispensa",
  "bevande",
  "casa e pulizia",
  AISLE_UNKNOWN,
] as const

export function aisleRank(aisle: string): number {
  const position = AISLE_ORDER.indexOf(aisle as (typeof AISLE_ORDER)[number])
  return position === -1 ? AISLE_ORDER.length : position
}
