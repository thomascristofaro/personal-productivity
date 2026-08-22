import { z } from "zod"

export const FinanceAccountIdSchema = z.cuid("Questo conto non è valido.")

export const MovementIdSchema = z.cuid("Questo movimento non è valido.")

// Declared here and not imported from the generated client: lib/schemas may
// import Zod and its own siblings and nothing else, and this is the tuple the
// Prisma enum mirrors.
export const FINANCE_PROVIDERS = ["SATISPAY", "REVOLUT", "INTESA"] as const

export const FinanceProviderSchema = z.enum(
  FINANCE_PROVIDERS,
  "Scegli un servizio."
)
export type FinanceProvider = z.infer<typeof FinanceProviderSchema>

// The labels, because the value is never what a person should read. A Base UI
// Select needs the map as `items` or it renders "REVOLUT" on screen — the
// standing decision of 2026-08-18.
export const FINANCE_PROVIDER_LABELS: Record<FinanceProvider, string> = {
  SATISPAY: "Satispay",
  REVOLUT: "Revolut",
  INTESA: "Intesa Sanpaolo",
}

// Ten million euro. Far above any balance this app will hold and far below what
// a slipped key produces.
const MAX_CENTS = 1_000_000_000

const AMOUNT = /^-?\d+([.]\d{1,2})?$/

/**
 * A balance as typed, in cents. Unlike the shopping total this may be negative:
 * a current account can be overdrawn, and refusing that would make the field
 * unusable exactly when it matters.
 */
export const SignedEuroCentsSchema = z
  .string()
  .trim()
  // One comma, because an Italian keyboard gives a comma and a numeric keypad
  // gives a dot. A thousands separator therefore fails the pattern below, and
  // the message says so rather than reading 1.234,56 as something else.
  .transform((value) => value.replace(",", "."))
  .refine((value) => value === "" || AMOUNT.test(value), {
    message: "Scrivi l’importo come 12,34, senza separatore delle migliaia.",
  })
  // Math.round and not a bare multiplication: 12.34 * 100 is
  // 1233.9999999999998, and truncating loses a cent on roughly every third
  // amount.
  .transform((value) => (value === "" ? 0 : Math.round(Number(value) * 100)))
  .refine((cents) => Math.abs(cents) <= MAX_CENTS, {
    message: "L’importo sembra troppo alto. Controlla la virgola.",
  })

/** A date as an `<input type="date">` posts it, at midnight UTC. */
export const IsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Scegli una data.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "Scegli una data.")

export const FinanceAccountInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dai un nome al conto.")
    .max(60, "Il nome può avere al massimo 60 caratteri."),
  provider: FinanceProviderSchema,
  shared: z.boolean(),
  // Named for what it returns. The form's field is `openingBalance`, and the
  // action is what maps one onto the other.
  openingBalanceCents: SignedEuroCentsSchema,
  openingBalanceAt: IsoDateSchema,
})

export type FinanceAccountInput = z.infer<typeof FinanceAccountInputSchema>

export const MovementNoteSchema = z
  .string()
  .trim()
  .max(500, "La nota può avere al massimo 500 caratteri.")
  // Empty is a real state — the note has been cleared — and null is how the
  // column spells it.
  .transform((value) => (value === "" ? null : value))
