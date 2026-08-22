"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireSession } from "@/lib/auth"
import { FinanceAccountIdSchema } from "@/lib/schemas/finance"
import { AccountNotVisibleError } from "@/lib/services/finance/access"
import {
  commitImport,
  type ImportOutcome,
  type ImportPreview,
  previewImport,
} from "@/lib/services/finance/import"
import { UnrecognisedFileError } from "@/lib/services/finance/parsers/types"

// One megabyte. A year of statements is tens of kilobytes, and Next's server
// actions have a body limit a bigger payload would hit as an opaque error
// rather than as this message.
const MAX_CHARACTERS = 1_000_000

const StatementSchema = z.object({
  accountId: FinanceAccountIdSchema,
  fileName: z.string().trim().min(1).max(255),
  text: z
    .string()
    .min(1, "Il file è vuoto.")
    .max(MAX_CHARACTERS, "Il file è troppo grande."),
})

export type ImportReply =
  | { ok: true; preview: ImportPreview; outcome?: undefined }
  | { ok: true; outcome: ImportOutcome; preview?: undefined }
  | { ok: false; message: string; expected?: string[]; found?: string[] }

// The two refusals a caller can do something about. Anything else is a bug and
// belongs in the error boundary, not in a message.
function refuse(error: unknown): ImportReply {
  if (error instanceof UnrecognisedFileError) {
    return {
      ok: false,
      message:
        "Questo file non sembra un estratto conto di questo servizio. Controlla il conto scelto e il file.",
      expected: [...error.expected],
      found: [...error.found],
    }
  }
  if (error instanceof AccountNotVisibleError) {
    return { ok: false, message: "Questo conto non esiste più." }
  }
  throw error
}

export async function previewStatement(input: unknown): Promise<ImportReply> {
  // Validate, then authenticate, then authorise. A server action is a public
  // endpoint, so none of the three may be skipped because the screen already
  // did it.
  const parsed = StatementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Scegli un conto e un file valido." }
  }

  const { userId } = await requireSession()

  try {
    return {
      ok: true,
      preview: await previewImport(
        userId,
        parsed.data.accountId,
        parsed.data.text
      ),
    }
  } catch (error) {
    return refuse(error)
  }
}

export async function importStatement(input: unknown): Promise<ImportReply> {
  const parsed = StatementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Scegli un conto e un file valido." }
  }

  const { userId } = await requireSession()

  try {
    const outcome = await commitImport(
      userId,
      parsed.data.accountId,
      parsed.data.fileName,
      parsed.data.text
    )

    revalidatePath("/finance")
    revalidatePath("/finance/movements")
    revalidatePath("/finance/import")
    revalidatePath("/finance/accounts")

    return { ok: true, outcome }
  } catch (error) {
    return refuse(error)
  }
}
