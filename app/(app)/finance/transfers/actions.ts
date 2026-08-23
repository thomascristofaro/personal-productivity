"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { MovementIdSchema } from "@/lib/schemas/finance"
import {
  confirmTransfer,
  listTransferCandidates,
  TransferNotPairableError,
} from "@/lib/services/finance/transfers"

function revalidate() {
  revalidatePath("/finance")
  revalidatePath("/finance/movements")
  revalidatePath("/finance/transfers")
}

// A pair confirmed from the other phone between this page rendering and the tap
// is a race, not an error to shout about. The screen re-renders without it,
// which is the outcome the tap wanted anyway.
async function ignoringRaces(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    if (!(error instanceof TransferNotPairableError)) throw error
  }
}

export async function confirmPair(
  rawOutgoingId: string,
  rawIncomingId: string
): Promise<void> {
  const outgoing = MovementIdSchema.safeParse(rawOutgoingId)
  const incoming = MovementIdSchema.safeParse(rawIncomingId)
  if (!outgoing.success || !incoming.success) return

  const { userId } = await requireSession()

  await ignoringRaces(() =>
    confirmTransfer(userId, outgoing.data, incoming.data)
  )

  revalidate()
}

export async function confirmAllSettled(): Promise<void> {
  const { userId } = await requireSession()

  // Read again on the server rather than taking a list from the client. A
  // payload naming pairs would let a forged call link two movements that are
  // not a pair, and a forged transfer hides an expense in the one category the
  // totals ignore.
  const candidates = await listTransferCandidates(userId)

  for (const pair of candidates) {
    if (pair.contested) continue
    await ignoringRaces(() =>
      confirmTransfer(userId, pair.outgoing.id, pair.incoming.id)
    )
  }

  revalidate()
}
