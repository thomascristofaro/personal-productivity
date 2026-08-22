import { db } from "@/lib/db"
import { assertAccountVisible, visibleTo } from "@/lib/services/finance/access"
import {
  type Fingerprinted,
  fingerprintOf,
  rowsToWrite,
} from "@/lib/services/finance/fingerprint"
import { readerFor } from "@/lib/services/finance/parsers"

export type ImportPreview = {
  accountName: string
  rowsRead: number
  unreadable: number
  newCount: number
  duplicateCount: number
  periodFrom: Date | null
  periodTo: Date | null
}

export type ImportOutcome = ImportPreview & { batchId: string }

export type ImportBatchSummary = {
  id: string
  accountName: string
  fileName: string
  rowsWritten: number
  rowsSkipped: number
  periodFrom: Date
  periodTo: Date
  createdAt: Date
}

type Prepared = {
  accountName: string
  rowsRead: number
  unreadable: number
  toWrite: (Fingerprinted & { occurrence: number })[]
  duplicateCount: number
  periodFrom: Date | null
  periodTo: Date | null
}

// The whole of an import except the writing, so the preview and the commit
// cannot disagree about what the file says.
async function prepare(
  actorId: string,
  accountId: string,
  text: string
): Promise<Prepared> {
  await assertAccountVisible(actorId, accountId)

  const account = await db.financeAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { name: true, provider: true },
  })

  // Throws UnrecognisedFileError, which reaches the screen unchanged: it carries
  // the columns it wanted and the columns it found, and that is the message.
  const read = readerFor(account.provider)(text)

  const fingerprinted: Fingerprinted[] = read.movements.map((movement) => ({
    ...movement,
    fingerprint: fingerprintOf(accountId, movement),
  }))

  const counts = await db.movement.groupBy({
    by: ["fingerprint"],
    where: {
      accountId,
      fingerprint: { in: fingerprinted.map((row) => row.fingerprint) },
    },
    _count: { fingerprint: true },
  })

  const existing = new Map(
    counts.map((row) => [row.fingerprint, row._count.fingerprint])
  )

  const { toWrite, skipped } = rowsToWrite(fingerprinted, existing)
  const dates = read.movements.map((movement) => movement.date.getTime())

  return {
    accountName: account.name,
    rowsRead: read.rowsRead,
    unreadable: read.unreadable,
    toWrite,
    duplicateCount: skipped,
    periodFrom: dates.length === 0 ? null : new Date(Math.min(...dates)),
    periodTo: dates.length === 0 ? null : new Date(Math.max(...dates)),
  }
}

function report(prepared: Prepared): ImportPreview {
  return {
    accountName: prepared.accountName,
    rowsRead: prepared.rowsRead,
    unreadable: prepared.unreadable,
    newCount: prepared.toWrite.length,
    duplicateCount: prepared.duplicateCount,
    periodFrom: prepared.periodFrom,
    periodTo: prepared.periodTo,
  }
}

/**
 * Reads a file and says what importing it would do, without writing anything.
 *
 * @param actorId - the user id, from the session
 * @param accountId - the account the file belongs to
 * @param text - the whole file, as the browser read it
 * @returns what the file holds and how much of it is new
 * @throws AccountNotVisibleError when the user cannot see the account
 * @throws UnrecognisedFileError when the file is not that provider's export
 */
export async function previewImport(
  actorId: string,
  accountId: string,
  text: string
): Promise<ImportPreview> {
  return report(await prepare(actorId, accountId, text))
}

/**
 * Writes what a file holds that is not already stored.
 *
 * The batch and its movements are one transaction: a batch claiming rows that
 * were never written would make the coverage it records a lie. `skipDuplicates`
 * leans on the unique index, so two imports racing settle in Postgres rather
 * than both believing they are first.
 *
 * @param actorId - the user id, from the session
 * @param accountId - the account the file belongs to
 * @param fileName - what to record in the history; never parsed
 * @param text - the whole file, as the browser read it
 * @returns what was written, and the batch that recorded it
 * @throws AccountNotVisibleError when the user cannot see the account
 * @throws UnrecognisedFileError when the file is not that provider's export
 */
export async function commitImport(
  actorId: string,
  accountId: string,
  fileName: string,
  text: string
): Promise<ImportOutcome> {
  const prepared = await prepare(actorId, accountId, text)

  const batchId = await db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        accountId,
        userId: actorId,
        fileName,
        rowsRead: prepared.rowsRead,
        rowsWritten: prepared.toWrite.length,
        rowsSkipped: prepared.duplicateCount,
        // A file with no readable row still records the attempt. The dates fall
        // back to today so the columns stay non-null and the history still says
        // somebody tried.
        periodFrom: prepared.periodFrom ?? new Date(),
        periodTo: prepared.periodTo ?? new Date(),
      },
      select: { id: true },
    })

    if (prepared.toWrite.length > 0) {
      await tx.movement.createMany({
        data: prepared.toWrite.map((row) => ({
          accountId,
          importBatchId: batch.id,
          date: row.date,
          amountCents: row.amountCents,
          description: row.description,
          providerCategory: row.providerCategory,
          providerRef: row.providerRef,
          fingerprint: row.fingerprint,
          occurrence: row.occurrence,
        })),
        skipDuplicates: true,
      })
    }

    return batch.id
  })

  return { ...report(prepared), batchId }
}

/**
 * The recent imports, newest first, so "have I already loaded July" has an
 * answer.
 *
 * @param actorId - the user id, from the session
 * @returns the last fifty imports across the accounts the user can see
 */
export async function listImports(
  actorId: string
): Promise<ImportBatchSummary[]> {
  const rows = await db.importBatch.findMany({
    where: { account: visibleTo(actorId) },
    select: {
      id: true,
      fileName: true,
      rowsWritten: true,
      rowsSkipped: true,
      periodFrom: true,
      periodTo: true,
      createdAt: true,
      account: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return rows.map((row) => ({
    id: row.id,
    accountName: row.account.name,
    fileName: row.fileName,
    rowsWritten: row.rowsWritten,
    rowsSkipped: row.rowsSkipped,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    createdAt: row.createdAt,
  }))
}
