export type PairableMovement = {
  id: string
  accountId: string
  date: Date
  amountCents: number
}

export type TransferCandidate = {
  outgoingId: string
  incomingId: string
  daysApart: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The pairs that look like one movement of money between two accounts.
 *
 * Nothing here decides anything: a candidate is shown and confirmed by hand,
 * because a false positive hides a real expense and would be found months
 * later.
 *
 * @param rows - the movements to consider; the caller has already excluded the
 *   ones already linked
 * @param windowDays - how many days the two legs may be apart
 * @returns `settled` pairs, whose two movements have no other candidate, and
 *   `contested` ones, where the owner has to choose
 */
export function pairCandidates(
  rows: readonly PairableMovement[],
  windowDays: number
): { settled: TransferCandidate[]; contested: TransferCandidate[] } {
  // Zero never pairs: two of them satisfy every rule below and mean nothing.
  const outgoings = rows.filter((row) => row.amountCents < 0)
  const incomings = rows.filter((row) => row.amountCents > 0)

  const candidates: TransferCandidate[] = []

  for (const outgoing of outgoings) {
    for (const incoming of incomings) {
      if (incoming.accountId === outgoing.accountId) continue
      if (incoming.amountCents !== -outgoing.amountCents) continue

      const daysApart = Math.round(
        Math.abs(incoming.date.getTime() - outgoing.date.getTime()) / DAY_MS
      )
      if (daysApart > windowDays) continue

      candidates.push({
        outgoingId: outgoing.id,
        incomingId: incoming.id,
        daysApart,
      })
    }
  }

  // A movement in two candidates makes both of them contested, and so does its
  // partner: "settled" has to mean nobody else wants either leg.
  const appearances = new Map<string, number>()
  for (const candidate of candidates) {
    for (const id of [candidate.outgoingId, candidate.incomingId]) {
      appearances.set(id, (appearances.get(id) ?? 0) + 1)
    }
  }

  const isSettled = (candidate: TransferCandidate) =>
    appearances.get(candidate.outgoingId) === 1 &&
    appearances.get(candidate.incomingId) === 1

  return {
    settled: candidates.filter(isSettled),
    contested: candidates.filter((candidate) => !isSettled(candidate)),
  }
}
