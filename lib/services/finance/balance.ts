/**
 * What an account holds now.
 *
 * Derived and never stored, so it cannot drift from the movements. Its value is
 * as a check: when this disagrees with what the provider's own app shows, an
 * import has a hole — which coverage dates cannot tell you, because they say how
 * far you got and not whether something is missing in the middle.
 *
 * @param openingCents - the balance on the opening day
 * @param openingAt - the day that balance was true, at midnight UTC
 * @param movements - the account's movements; ones before the opening day are
 *   ignored, because the opening balance already contains them
 * @returns the balance in integer cents
 */
export function balanceCents(
  openingCents: number,
  openingAt: Date,
  movements: readonly { date: Date; amountCents: number }[]
): number {
  return movements.reduce(
    (total, movement) =>
      movement.date.getTime() < openingAt.getTime()
        ? total
        : total + movement.amountCents,
    openingCents
  )
}
