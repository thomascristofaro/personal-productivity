# Finance Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** get the money into the app. Accounts with a derived balance, three
readers that turn an exported statement into rows, an import that cannot lose a
movement and cannot duplicate one, and the screens to look at what arrived.

**Architecture:** everything that decides anything is a pure function under
`lib/services/finance/` — splitting a CSV, reading an amount, fingerprinting a
row, working out which rows are new, summing a balance. The database functions
are thin wrappers around them and the screens are thin callers of those. This is
what makes the risky half testable in an environment with no browser and no
database, which is the only environment this repository's tests run in.

**Tech Stack:** Prisma 7 with the `pg` driver adapter, Next.js App Router server
components and server actions, Zod, shadcn/Base UI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-23-finance-design.md`](../specs/2026-08-23-finance-design.md)
— §3 to §5, §8.1, §9.2 to §9.4, §9.6, §12 "Plan 2".

## Global Constraints

- **`lib/services/` is the backend.** No imports from `app/`, `components/` or
  `hooks/`; no React, no `next/*`; no `Request`, `Response`, `cookies()` or
  `headers()`. ESLint fails `pnpm verify` on a violation.
- **`actorId` is reserved**: it means an identity the caller already verified
  from the session. It never comes from a payload, and ESLint rejects the name
  in `lib/schemas/`.
- **Zod validates every external input**, at the route handler and **inside
  every server action**. Validate, then authenticate, then authorise, then
  mutate.
- **Money is integer cents.** Never a Prisma `Decimal` — it does not survive the
  server-to-client component boundary. `lib/money.ts` formats; parsing lives in
  `lib/schemas/`.
- **Dates that are calendar dates use `@db.Date`**, produced through
  `APP_TIMEZONE` the way `lib/week.ts` does it.
- **Italian for what the user reads**; English for identifiers, comments, TSDoc,
  file names, test names, commit messages. URL segments are English.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary,
  `@param`, `@returns`, `@throws`. No types in it. ESLint enforces this.
- **Every base component comes from shadcn/ui**, edited in place in
  `components/ui/` when it needs changing. Never wrapped, never hand-written.
- **Server components by default**; `"use client"` as far down the tree as
  possible.
- **Tests run in `environment: "node"`.** No component tests. Assert pure
  functions; verify screens in the browser against the checklist at the end.
- **`pnpm verify` before claiming anything works.**
- **A new required environment variable must be added in three places** —
  `lib/env.ts`, `vitest.config.ts` and the fixture in `lib/env.test.ts`. This
  plan adds none; if you find yourself adding one, that rule applies.
- Commit messages in English, ending with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Two decisions taken while writing this plan

Both amend the spec, and both are recorded in it as part of Task 13.

**1. The finance module is visible to everyone.** §2.1 hid it until you could
see an account. That cannot work: with no accounts nobody sees the module, and
the only place to create the first account is inside it. `/finance` with nothing
to show is not an empty room — it is a screen offering to add the first account.
§3's per-account authorisation is untouched, and it is where the privacy
actually lives.

**2. The file is read in the browser and posted as text.** §5.1 requires the
preview to be shown before anything is written, which means the same file must
survive two round trips. A file input cannot be re-submitted after one. So the
import screen is a client component that reads the file with `FileReader` and
holds the text: the first server action returns the preview, the second writes.
Nothing is stored between them. A file over 1 MB is refused before it is read —
Next's server actions have a body limit, and a statement is tens of kilobytes.

## The state of the three formats

The Revolut layout below is the one its statement export has had for years. **The
Intesa Sanpaolo and Satispay column names in Task 5 are informed guesses**: no
real export has been read yet.

This is contained on purpose. Each reader is a `COLUMNS` map and a handful of
conversions over the shared core of Tasks 3 and 4, so correcting one against a
real file is editing a list of strings and a fixture. A file whose header does
not match raises `UnrecognisedFileError`, which carries the columns it expected
and the columns it found, and the import screen prints both — so the first real
file diagnoses itself.

**CSV only.** If the Intesa export turns out to be XLSX with no CSV option, this
plan does not read it: the owner saves it as CSV, and whether to take on a
spreadsheet dependency is a decision for its own conversation. Do not add one
here.

---

### Task 1: The schema

**Files:**

- Modify: `prisma/schema.prisma`
- Create: the migration `prisma/migrations/<timestamp>_finance_core/`

**Interfaces:**

- Consumes: nothing.
- Produces: `FinanceProvider`, `FinanceAccount`, `Movement`, `ImportBatch` on the
  Prisma client, and the back-relations `User.financeAccounts` and
  `User.importBatches`.

- [ ] **Step 1: Add the models**

Append to `prisma/schema.prisma`, after the `Purchase` models and before the
better-auth block:

```prisma
// The finance module. Its design is
// docs/superpowers/specs/2026-08-23-finance-design.md.

enum FinanceProvider {
  SATISPAY
  REVOLUT
  INTESA
}

// A place money sits. "FinanceAccount" and not "Account": the latter is
// better-auth's, and renaming that one needs a mapping in lib/auth/better-auth.ts.
model FinanceAccount {
  id       String          @id @default(cuid())
  name     String
  // An enum and not free text: it selects which reader parses an upload, so an
  // unknown value would have no behaviour.
  provider FinanceProvider
  ownerId  String
  owner    User            @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  // Visible to both users. Ownership is the module's only authorisation rule —
  // design document section 3.
  shared   Boolean         @default(false)
  // The balance is derived, never stored: opening balance plus every movement
  // from that date on. A stored balance diverges from the truth in silence.
  openingBalanceCents Int      @default(0)
  openingBalanceAt    DateTime @db.Date
  createdAt           DateTime @default(now())
  updatedAt           DateTime @default(now()) @updatedAt

  movements Movement[]
  imports   ImportBatch[]

  @@index([ownerId])
}

// One line of a statement, never edited after import — correcting a description
// would make the next import of that period write it again beside the
// correction. `note` is where a human remark goes.
model Movement {
  id          String         @id @default(cuid())
  accountId   String
  account     FinanceAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  date        DateTime       @db.Date
  // Integer cents, negative for an outgoing. One column and not two: a dare and
  // an avere column would let a row be both or neither.
  amountCents Int
  description String
  // What the file declared, verbatim. Null when the file declares nothing.
  providerCategory String?
  // The provider's own transaction id, when the file carries one.
  providerRef      String?
  // See lib/services/finance/fingerprint.ts. Two identical rows on one day share
  // this, which is why `occurrence` exists.
  fingerprint String
  occurrence  Int    @default(0)
  note        String?
  // Nullable with SetNull rather than a required parent: deleting an import must
  // never take its movements with it, and it removes the delete-ordering problem
  // when an account cascades both.
  importBatchId String?
  importBatch   ImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)
  createdAt     DateTime     @default(now())

  // The duplicate rule, enforced by Postgres and not only by the service: two
  // imports racing cannot both decide they are writing the first occurrence.
  @@unique([accountId, fingerprint, occurrence])
  @@index([accountId, date])
}

// What was loaded, by whom, and what it did. Not an undo: re-importing the same
// file is harmless, so nothing needs to be taken back.
model ImportBatch {
  id          String         @id @default(cuid())
  accountId   String
  account     FinanceAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  fileName    String
  rowsRead    Int
  rowsWritten Int
  rowsSkipped Int
  periodFrom  DateTime       @db.Date
  periodTo    DateTime       @db.Date
  createdAt   DateTime       @default(now())

  movements Movement[]

  @@index([accountId, createdAt])
}
```

- [ ] **Step 2: Add the back-relations to `User`**

Prisma requires the other side of each relation. In `model User`, after
`accounts Account[]`:

```prisma
  financeAccounts FinanceAccount[]
  importBatches   ImportBatch[]
```

- [ ] **Step 3: Create and apply the migration**

Run: `pnpm db:migrate`
When prompted for a name, answer `finance_core`.
Expected: a new folder under `prisma/migrations/`, applied to the local
Postgres on port 5433. It must not touch production — there is no direct
connection on this machine, by decision.

- [ ] **Step 4: Regenerate the client and typecheck**

Run: `pnpm db:generate && pnpm typecheck`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: three tables for money that has already moved

An account with an opening balance rather than a balance, because a
stored balance drifts and a derived one cannot. A movement carrying the
fingerprint and the occurrence that let a re-import recognise itself,
with the pair unique in Postgres and not only in the service. An import
batch that records what a file did without being able to take it back.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Splitting a CSV

**Files:**

- Create: `lib/services/finance/csv.ts`
- Create: `lib/services/finance/csv.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `splitCsv(text: string): string[][]`

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { splitCsv } from "@/lib/services/finance/csv"

describe("splitCsv", () => {
  it("reads plain comma-separated rows", () => {
    expect(splitCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("picks the semicolon when the header uses one", () => {
    expect(splitCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("keeps a comma that is inside quotes", () => {
    expect(splitCsv('a,b\n"uno, due",3')).toEqual([
      ["a", "b"],
      ["uno, due", "3"],
    ])
  })

  it("keeps a newline that is inside quotes", () => {
    expect(splitCsv('a,b\n"uno\ndue",3')).toEqual([
      ["a", "b"],
      ["uno\ndue", "3"],
    ])
  })

  it("reads a doubled quote as one quote", () => {
    expect(splitCsv('a\n"lui disse ""ciao"""')).toEqual([
      ["a"],
      ['lui disse "ciao"'],
    ])
  })

  it("survives CRLF line endings", () => {
    expect(splitCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("strips a byte order mark, so the first header is not \\ufeffData", () => {
    expect(splitCsv("﻿Data,Importo\n1,2")[0]).toEqual(["Data", "Importo"])
  })

  it("drops trailing blank lines rather than emitting an empty row", () => {
    expect(splitCsv("a,b\n1,2\n\n")).toHaveLength(2)
  })

  it("returns nothing for an empty file", () => {
    expect(splitCsv("")).toEqual([])
  })

  it("keeps an empty field in the middle of a row", () => {
    expect(splitCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/csv.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/finance/csv`.

- [ ] **Step 3: Write the implementation**

Create `lib/services/finance/csv.ts`:

```ts
// The three readers share this. A statement is a small file written by a bank,
// not arbitrary user input, but "small file written by a bank" still includes a
// description with a comma in it, a semicolon-separated Italian export, and a
// byte order mark — each of which silently corrupts a naive split.

const DELIMITERS = [";", ",", "\t"] as const

// The delimiter that appears most often outside quotes on the first line. Real
// files are not ambiguous about this; guessing wrongly produces one column,
// which the readers then refuse by name.
function delimiterOf(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length)
  let best = ","
  let bestCount = -1

  for (const candidate of DELIMITERS) {
    const count = firstLine.split(candidate).length - 1
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

/**
 * Splits a CSV file into rows of fields.
 *
 * @param text - the whole file
 * @returns one array per row; an empty array for an empty file
 */
export function splitCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n")
  if (clean.trim() === "") return []

  const delimiter = delimiterOf(clean)
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]

    if (quoted) {
      if (char === '"') {
        // A doubled quote is one quote; a single one closes the field.
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // A file ending in a newline leaves a row of one empty field, and so does a
  // blank line between records. Neither is data.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/csv.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/finance/csv.ts lib/services/finance/csv.test.ts
git commit -m "feat: a CSV splitter that survives what banks actually export

A comma inside a quoted description, a semicolon-separated Italian
file, a byte order mark on the first header, CRLF. Each of these turns
a naive split into wrong data rather than into an error, which is the
kind of failure this module cannot have.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Reading an amount and a date

**Files:**

- Create: `lib/services/finance/values.ts`
- Create: `lib/services/finance/values.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `amountToCents(raw: string): number | null`
  - `dateToUtcMidnight(raw: string): Date | null`

Both return null for anything they cannot read, so a bad row becomes a counted
unreadable row rather than a silent zero.

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/values.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

describe("amountToCents", () => {
  it("reads a plain decimal point, as Revolut writes it", () => {
    expect(amountToCents("-12.50")).toBe(-1250)
  })

  it("reads a decimal comma, as an Italian export writes it", () => {
    expect(amountToCents("-12,50")).toBe(-1250)
  })

  it("reads a thousands dot with a decimal comma", () => {
    expect(amountToCents("1.234,56")).toBe(123456)
  })

  it("reads a thousands comma with a decimal point", () => {
    expect(amountToCents("1,234.56")).toBe(123456)
  })

  it("reads a lone separator followed by three digits as thousands", () => {
    expect(amountToCents("1.234")).toBe(123400)
  })

  it("reads a lone separator followed by two digits as decimals", () => {
    expect(amountToCents("12.34")).toBe(1234)
  })

  it("ignores a currency symbol and the space before it", () => {
    expect(amountToCents("12,50 €")).toBe(1250)
    expect(amountToCents("€ 12,50")).toBe(1250)
  })

  it("keeps an explicit plus", () => {
    expect(amountToCents("+200,00")).toBe(20000)
  })

  it("reads the unicode minus some exports use", () => {
    expect(amountToCents("−12,50")).toBe(-1250)
  })

  it("rounds rather than truncating, so a cent is not lost", () => {
    // 12.34 * 100 is 1233.9999999999998 in binary floating point.
    expect(amountToCents("12,34")).toBe(1234)
  })

  it("returns null for something that is not an amount", () => {
    expect(amountToCents("")).toBeNull()
    expect(amountToCents("n/d")).toBeNull()
    expect(amountToCents("--3")).toBeNull()
  })
})

describe("dateToUtcMidnight", () => {
  it("reads an ISO date", () => {
    expect(dateToUtcMidnight("2026-07-15")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("drops the time an ISO timestamp carries", () => {
    expect(dateToUtcMidnight("2026-07-15 23:40:00")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a slashed Italian date", () => {
    expect(dateToUtcMidnight("15/07/2026")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a dotted Italian date", () => {
    expect(dateToUtcMidnight("15.07.2026")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a two-digit year as this century", () => {
    expect(dateToUtcMidnight("15/07/26")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("refuses a day that does not exist rather than rolling into August", () => {
    expect(dateToUtcMidnight("31/06/2026")).toBeNull()
  })

  it("returns null for something that is not a date", () => {
    expect(dateToUtcMidnight("")).toBeNull()
    expect(dateToUtcMidnight("ieri")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/values.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/finance/values`.

- [ ] **Step 3: Write the implementation**

Create `lib/services/finance/values.ts`:

```ts
// Every provider writes the same two facts differently, and every one of those
// spellings has a way of being read wrongly rather than not at all. Both
// functions therefore return null instead of guessing: an unreadable row is
// counted and shown, and a row read as zero would be a lie.

const AMOUNT_SHAPE = /^[+-]?\d+(?:[.,]\d+)*$/

/**
 * Reads an amount as integer cents.
 *
 * @param raw - the field as the file wrote it
 * @returns the amount in cents, negative for an outgoing, or null when the
 *   field is not an amount
 */
export function amountToCents(raw: string): number | null {
  // The unicode minus, the euro sign, spaces and non-breaking spaces. Anything
  // left that is not a digit, a separator or a sign fails the shape below.
  const cleaned = raw
    .replace(/−/g, "-")
    .replace(/[€\s ]/g, "")
    .trim()

  if (cleaned === "" || !AMOUNT_SHAPE.test(cleaned)) return null

  const sign = cleaned.startsWith("-") ? -1 : 1
  const digits = cleaned.replace(/^[+-]/, "")

  const lastDot = digits.lastIndexOf(".")
  const lastComma = digits.lastIndexOf(",")
  const lastSeparator = Math.max(lastDot, lastComma)

  let whole = digits
  let fraction = ""

  if (lastSeparator !== -1) {
    const tail = digits.slice(lastSeparator + 1)
    const isThousands =
      // Three digits after the last separator, and something before it: this is
      // 1.234, not 1.23. Two separators of different kinds settle it on their
      // own, because only the last one can be the decimal.
      tail.length === 3 && lastDot !== -1 && lastComma !== -1
        ? false
        : tail.length === 3
    if (!isThousands) {
      whole = digits.slice(0, lastSeparator)
      fraction = tail
    }
  }

  const wholeDigits = whole.replace(/[.,]/g, "")
  const cents =
    Number(wholeDigits === "" ? "0" : wholeDigits) * 100 +
    // Math.round on the fraction rather than on the product: it is already an
    // integer number of cents once padded, and multiplying euros by 100 in
    // binary floating point loses one on roughly every third amount.
    Math.round(Number(`0.${fraction === "" ? "0" : fraction}`) * 100)

  return sign * cents
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/
const ITALIAN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})/

/**
 * Reads a calendar date as midnight UTC, the convention `@db.Date` columns use.
 *
 * @param raw - the field as the file wrote it, with or without a time
 * @returns the date at midnight UTC, or null when the field is not a date
 */
export function dateToUtcMidnight(raw: string): Date | null {
  const trimmed = raw.trim()

  const iso = ISO.exec(trimmed)
  if (iso !== null) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const italian = ITALIAN.exec(trimmed)
  if (italian !== null) {
    const year = Number(italian[3])
    return build(
      year < 100 ? 2000 + year : year,
      Number(italian[2]),
      Number(italian[1])
    )
  }

  return null
}

function build(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC rolls 31 June into 1 July without complaining. Comparing back is
  // what turns a typo in a file into an unreadable row rather than a movement
  // dated a day that never happened.
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/values.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/finance/values.ts lib/services/finance/values.test.ts
git commit -m "feat: read an amount and a date the way three providers write them

Both return null rather than guessing. An amount read as zero and a
date rolled from 31 June into 1 July are both wrong data that looks
like data, and this module's one unacceptable failure is a movement
that quietly says something untrue.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The reader contract, and the three readers

**Files:**

- Create: `lib/services/finance/parsers/types.ts`
- Create: `lib/services/finance/parsers/revolut.ts`
- Create: `lib/services/finance/parsers/intesa.ts`
- Create: `lib/services/finance/parsers/satispay.ts`
- Create: `lib/services/finance/parsers/index.ts`
- Create: `lib/services/finance/parsers/parsers.test.ts`

**Interfaces:**

- Consumes: `splitCsv` (Task 2), `amountToCents`, `dateToUtcMidnight` (Task 3).
- Produces:
  - `type ParsedMovement = { date: Date; amountCents: number; description: string; providerCategory: string | null; providerRef: string | null }`
  - `type ReadResult = { movements: ParsedMovement[]; rowsRead: number; unreadable: number }`
  - `class UnrecognisedFileError extends Error` with `expected: string[]` and `found: string[]`
  - `readerFor(provider: FinanceProvider): (text: string) => ReadResult`

- [ ] **Step 1: Write the contract**

Create `lib/services/finance/parsers/types.ts`:

```ts
export type ParsedMovement = {
  // Midnight UTC, the @db.Date convention.
  date: Date
  // Integer cents, negative for an outgoing.
  amountCents: number
  description: string
  // What the file declared as its own category, verbatim. Null when it declares
  // none. Never interpreted here — that is the next plan's work.
  providerCategory: string | null
  // The provider's own transaction id, when the file carries one.
  providerRef: string | null
}

export type ReadResult = {
  movements: ParsedMovement[]
  // Data rows the file held, excluding the header and any preamble.
  rowsRead: number
  // Rows that had the right shape but an amount or a date that could not be
  // read. Counted and reported; never silently dropped.
  unreadable: number
}

/**
 * Thrown when a file does not look like an export from the chosen provider.
 *
 * Carries both column lists so the screen can print them: the first real export
 * of a provider whose layout was guessed diagnoses itself this way.
 */
export class UnrecognisedFileError extends Error {
  constructor(
    readonly expected: readonly string[],
    readonly found: readonly string[]
  ) {
    super("The file's columns do not match the reader's.")
    this.name = "UnrecognisedFileError"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/services/finance/parsers/parsers.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { readerFor } from "@/lib/services/finance/parsers"
import { UnrecognisedFileError } from "@/lib/services/finance/parsers/types"

const revolutFile = [
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
  "CARD_PAYMENT,Current,2026-07-15 09:12:00,2026-07-15 09:12:00,Esselunga,-42.30,0.00,EUR,COMPLETED,1200.00",
  "TOPUP,Current,2026-07-16 10:00:00,2026-07-16 10:00:00,Payment from Thomas,200.00,0.00,EUR,COMPLETED,1400.00",
  "CARD_PAYMENT,Current,2026-07-17 10:00:00,2026-07-17 10:00:00,Bar,-1.50,0.00,EUR,PENDING,1398.50",
  "ATM,Current,2026-07-18 10:00:00,2026-07-18 10:00:00,Prelievo,-100.00,1.50,EUR,COMPLETED,1297.00",
].join("\n")

const intesaFile = [
  "Elenco movimenti",
  "Conto: IT00X0000000000000000000000",
  "",
  "Data,Operazione,Dettagli,Conto o carta,Contabilizzazione,Categoria,Valuta,Importo",
  '15/07/2026,Pagamento POS,"ESSELUNGA SPA, MILANO",Conto,15/07/2026,Spesa,EUR,"-42,30"',
  '16/07/2026,Bonifico,Stipendio,Conto,16/07/2026,Entrate,EUR,"1.850,00"',
].join("\n")

const satispayFile = [
  "ID,Data,Nome,Tipo,Stato,Importo",
  "abc123,15/07/2026,Bar Centrale,Pagamento,ACCETTATO,\"-3,50\"",
  "def456,16/07/2026,Marco,Ricarica,ACCETTATO,\"25,00\"",
].join("\n")

describe("the Revolut reader", () => {
  const read = readerFor("REVOLUT")

  it("reads a card payment as a negative amount on its completed date", () => {
    const first = read(revolutFile).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.description).toBe("Esselunga")
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("takes the row's Type as the category the provider declared", () => {
    expect(read(revolutFile).movements[0]?.providerCategory).toBe(
      "CARD_PAYMENT"
    )
  })

  it("skips a row that is not COMPLETED, because it may still be reversed", () => {
    expect(
      read(revolutFile).movements.some((m) => m.description === "Bar")
    ).toBe(false)
  })

  it("emits a fee as its own movement, so it is not hidden inside another", () => {
    const fee = read(revolutFile).movements.find((m) =>
      m.description.startsWith("Commissione")
    )
    expect(fee?.amountCents).toBe(-150)
    expect(fee?.description).toBe("Commissione — Prelievo")
  })

  it("counts every data row it was given", () => {
    expect(read(revolutFile).rowsRead).toBe(4)
  })

  it("refuses a file whose columns are somebody else's", () => {
    expect(() => read(intesaFile)).toThrow(UnrecognisedFileError)
  })
})

describe("the Intesa reader", () => {
  const read = readerFor("INTESA")

  it("finds the header under the export's preamble", () => {
    expect(read(intesaFile).rowsRead).toBe(2)
  })

  it("reads an Italian amount and date", () => {
    const first = read(intesaFile).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("joins the operation and its details into one description", () => {
    expect(read(intesaFile).movements[0]?.description).toBe(
      "Pagamento POS — ESSELUNGA SPA, MILANO"
    )
  })

  it("keeps the declared category verbatim", () => {
    expect(read(intesaFile).movements[0]?.providerCategory).toBe("Spesa")
  })

  it("reads a thousands separator as thousands", () => {
    expect(read(intesaFile).movements[1]?.amountCents).toBe(185000)
  })
})

describe("the Satispay reader", () => {
  const read = readerFor("SATISPAY")

  it("keeps the provider's own id, which makes duplicates exact", () => {
    expect(read(satispayFile).movements[0]?.providerRef).toBe("abc123")
  })

  it("reads the amount and the counterparty", () => {
    const first = read(satispayFile).movements[0]
    expect(first?.amountCents).toBe(-350)
    expect(first?.description).toBe("Bar Centrale")
  })
})

describe("every reader", () => {
  it("counts a row it cannot read instead of dropping it in silence", () => {
    const broken = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "CARD_PAYMENT,Current,2026-07-15 09:12:00,2026-07-15 09:12:00,Rotto,n/d,0.00,EUR,COMPLETED,0",
    ].join("\n")

    const result = readerFor("REVOLUT")(broken)
    expect(result.movements).toHaveLength(0)
    expect(result.unreadable).toBe(1)
    expect(result.rowsRead).toBe(1)
  })

  it("refuses an empty file", () => {
    expect(() => readerFor("REVOLUT")("")).toThrow(UnrecognisedFileError)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/parsers`
Expected: FAIL — cannot resolve `@/lib/services/finance/parsers`.

- [ ] **Step 4: Write the shared header machinery and the Revolut reader**

Create `lib/services/finance/parsers/revolut.ts`:

```ts
import { splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// The columns this reader needs. Correcting the reader against a real export is
// editing this list and the fixture in the test, and nothing else.
const REQUIRED = [
  "Completed Date",
  "Description",
  "Amount",
  "Fee",
  "State",
  "Type",
] as const

/**
 * Reads a Revolut account statement export.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the header is not Revolut's
 */
export function readRevolut(text: string): ReadResult {
  const rows = splitCsv(text)
  const header = rows[0] ?? []
  const index = new Map(header.map((name, at) => [name.trim(), at]))

  const missing = REQUIRED.filter((name) => !index.has(name))
  if (missing.length > 0) throw new UnrecognisedFileError(REQUIRED, header)

  const at = (row: string[], name: string) =>
    (row[index.get(name) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(1)

  for (const row of data) {
    // Anything else may still be reverted, and a reverted payment that was
    // imported is money the summary says was spent and never was.
    if (at(row, "State") !== "COMPLETED") continue

    const date = dateToUtcMidnight(at(row, "Completed Date"))
    const amountCents = amountToCents(at(row, "Amount"))
    const description = at(row, "Description")

    if (date === null || amountCents === null || description === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      description,
      providerCategory: at(row, "Type") || null,
      providerRef: null,
    })

    // A fee is a real outgoing. Folding it into the amount beside it would make
    // the payment look bigger than it was and the fee disappear as a line.
    const feeCents = amountToCents(at(row, "Fee"))
    if (feeCents !== null && feeCents !== 0) {
      movements.push({
        date,
        amountCents: -Math.abs(feeCents),
        description: `Commissione — ${description}`,
        providerCategory: "FEE",
        providerRef: null,
      })
    }
  }

  return { movements, rowsRead: data.length, unreadable }
}
```

- [ ] **Step 5: Write the Intesa reader**

Create `lib/services/finance/parsers/intesa.ts`:

```ts
import { splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// UNVERIFIED against a real export — see the plan's "state of the three
// formats". Correcting this reader is editing this list and the fixture.
const REQUIRED = ["Data", "Operazione", "Importo"] as const
const OPTIONAL = ["Dettagli", "Categoria"] as const

/**
 * Reads an Intesa Sanpaolo statement export.
 *
 * The export opens with a preamble of title and account rows, so the header is
 * looked for rather than assumed to be first.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when no row in the file is Intesa's header
 */
export function readIntesa(text: string): ReadResult {
  const rows = splitCsv(text)

  const headerAt = rows.findIndex((row) => {
    const names = row.map((name) => name.trim())
    return REQUIRED.every((name) => names.includes(name))
  })

  if (headerAt === -1) {
    throw new UnrecognisedFileError(REQUIRED, rows[0] ?? [])
  }

  const header = rows[headerAt] ?? []
  const index = new Map(header.map((name, position) => [name.trim(), position]))
  const at = (row: string[], name: string) =>
    (row[index.get(name) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(headerAt + 1)

  for (const row of data) {
    const date = dateToUtcMidnight(at(row, "Data"))
    const amountCents = amountToCents(at(row, "Importo"))
    const operation = at(row, "Operazione")
    const details = at(row, OPTIONAL[0])

    if (date === null || amountCents === null || operation === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      // Both, because on their own the operation says "Pagamento POS" for
      // everything and the details say a shop with no verb.
      description: details === "" ? operation : `${operation} — ${details}`,
      providerCategory: at(row, OPTIONAL[1]) || null,
      providerRef: null,
    })
  }

  return { movements, rowsRead: data.length, unreadable }
}
```

- [ ] **Step 6: Write the Satispay reader**

Create `lib/services/finance/parsers/satispay.ts`:

```ts
import { splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// UNVERIFIED against a real export — see the plan's "state of the three
// formats". Correcting this reader is editing this list and the fixture.
const REQUIRED = ["Data", "Nome", "Importo"] as const
const OPTIONAL = ["ID", "Tipo", "Stato"] as const

/**
 * Reads a Satispay movements export.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the header is not Satispay's
 */
export function readSatispay(text: string): ReadResult {
  const rows = splitCsv(text)
  const header = rows[0] ?? []
  const index = new Map(header.map((name, at) => [name.trim(), at]))

  const missing = REQUIRED.filter((name) => !index.has(name))
  if (missing.length > 0) throw new UnrecognisedFileError(REQUIRED, header)

  const at = (row: string[], name: string) =>
    (row[index.get(name) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(1)

  for (const row of data) {
    // A refused or cancelled payment never moved money. The column is optional
    // because it may not exist in the real export; when it does not, every row
    // counts, which is the safe direction.
    const state = at(row, OPTIONAL[2])
    if (state !== "" && !/accett|success|complet/i.test(state)) continue

    const date = dateToUtcMidnight(at(row, "Data"))
    const amountCents = amountToCents(at(row, "Importo"))
    const name = at(row, "Nome")

    if (date === null || amountCents === null || name === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      description: name,
      providerCategory: at(row, OPTIONAL[1]) || null,
      // The only one of the three known to carry an id. When it does, it makes
      // a movement unique on its own and the occurrence counting never engages.
      providerRef: at(row, OPTIONAL[0]) || null,
    })
  }

  return { movements, rowsRead: data.length, unreadable }
}
```

- [ ] **Step 7: Write the registry**

Create `lib/services/finance/parsers/index.ts`:

```ts
import type { FinanceProvider } from "@/lib/generated/prisma/enums"
import { readIntesa } from "@/lib/services/finance/parsers/intesa"
import { readRevolut } from "@/lib/services/finance/parsers/revolut"
import { readSatispay } from "@/lib/services/finance/parsers/satispay"
import type { ReadResult } from "@/lib/services/finance/parsers/types"

const READERS: Record<FinanceProvider, (text: string) => ReadResult> = {
  REVOLUT: readRevolut,
  INTESA: readIntesa,
  SATISPAY: readSatispay,
}

/**
 * The reader that knows a provider's export format.
 *
 * @param provider - the account's provider
 * @returns a function taking the file's text and returning what it holds
 */
export function readerFor(
  provider: FinanceProvider
): (text: string) => ReadResult {
  return READERS[provider]
}
```

If `@/lib/generated/prisma/enums` does not resolve, check how another file
imports a Prisma enum — `lib/schemas/catalog.ts` imports `CatalogItemKind` — and
follow that path exactly.

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/parsers`
Expected: PASS, 15 tests.

- [ ] **Step 9: Commit**

```bash
git add lib/services/finance/parsers
git commit -m "feat: one reader per provider, and a refusal that names the columns

Three formats, one shape out. A file whose header is not the reader's
raises rather than importing half of it, and carries both column lists
so the screen can print them — which is how the first real Intesa and
Satispay exports will correct the guesses these two are built on.

A Revolut fee becomes its own movement. Folded into the payment beside
it, the payment would read bigger than it was and the fee would stop
existing as a line.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Recognising a duplicate without losing a movement

**Files:**

- Create: `lib/services/finance/fingerprint.ts`
- Create: `lib/services/finance/fingerprint.test.ts`

**Interfaces:**

- Consumes: `ParsedMovement` (Task 4).
- Produces:
  - `fingerprintOf(accountId: string, movement: ParsedMovement): string`
  - `type Fingerprinted = ParsedMovement & { fingerprint: string }`
  - `rowsToWrite(parsed: readonly Fingerprinted[], existing: ReadonlyMap<string, number>): { toWrite: (Fingerprinted & { occurrence: number })[]; skipped: number }`

This is the task that carries the defect the whole module must not have. Read
§5.3 of the spec before writing it.

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/fingerprint.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  type Fingerprinted,
  fingerprintOf,
  rowsToWrite,
} from "@/lib/services/finance/fingerprint"

const movement = (over: Partial<Fingerprinted> = {}) => ({
  date: new Date("2026-07-15T00:00:00.000Z"),
  amountCents: -150,
  description: "Bar Centrale",
  providerCategory: null,
  providerRef: null,
  ...over,
})

const withPrint = (over: Partial<Fingerprinted> = {}): Fingerprinted => {
  const base = movement(over)
  return { ...base, fingerprint: fingerprintOf("acc", base) }
}

describe("fingerprintOf", () => {
  it("gives the same row the same fingerprint twice", () => {
    expect(fingerprintOf("acc", movement())).toBe(
      fingerprintOf("acc", movement())
    )
  })

  it("ignores case and spacing in the description", () => {
    expect(fingerprintOf("acc", movement({ description: "BAR  centrale" }))).toBe(
      fingerprintOf("acc", movement({ description: "Bar Centrale" }))
    )
  })

  it("separates two accounts", () => {
    expect(fingerprintOf("acc", movement())).not.toBe(
      fingerprintOf("other", movement())
    )
  })

  it("separates two amounts", () => {
    expect(fingerprintOf("acc", movement({ amountCents: -151 }))).not.toBe(
      fingerprintOf("acc", movement())
    )
  })

  it("separates two dates", () => {
    expect(
      fingerprintOf("acc", movement({ date: new Date("2026-07-16T00:00:00Z") }))
    ).not.toBe(fingerprintOf("acc", movement()))
  })

  it("separates two provider ids, which is what makes them exact", () => {
    expect(fingerprintOf("acc", movement({ providerRef: "a" }))).not.toBe(
      fingerprintOf("acc", movement({ providerRef: "b" }))
    )
  })
})

describe("rowsToWrite", () => {
  it("writes both of two identical coffees on the same day", () => {
    // The defect this module must not have. Comparing rows rather than counting
    // them deletes the second one, and a real outgoing disappears in silence.
    const file = [withPrint(), withPrint()]
    const { toWrite, skipped } = rowsToWrite(file, new Map())

    expect(toWrite).toHaveLength(2)
    expect(toWrite.map((row) => row.occurrence)).toEqual([0, 1])
    expect(skipped).toBe(0)
  })

  it("writes only the second when the first is already stored", () => {
    const file = [withPrint(), withPrint()]
    const stored = new Map([[file[0]!.fingerprint, 1]])
    const { toWrite, skipped } = rowsToWrite(file, stored)

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.occurrence).toBe(1)
    expect(skipped).toBe(1)
  })

  it("writes nothing when the same file is imported twice", () => {
    const file = [withPrint(), withPrint({ amountCents: -900 })]
    const stored = new Map(file.map((row) => [row.fingerprint, 1]))
    const { toWrite, skipped } = rowsToWrite(file, stored)

    expect(toWrite).toEqual([])
    expect(skipped).toBe(2)
  })

  it("continues the numbering from what is stored", () => {
    const file = [withPrint(), withPrint(), withPrint()]
    const stored = new Map([[file[0]!.fingerprint, 2]])
    const { toWrite } = rowsToWrite(file, stored)

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.occurrence).toBe(2)
  })

  it("counts each fingerprint on its own", () => {
    const bar = withPrint()
    const shop = withPrint({ description: "Esselunga", amountCents: -4230 })
    const { toWrite } = rowsToWrite(
      [bar, shop],
      new Map([[bar.fingerprint, 1]])
    )

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.description).toBe("Esselunga")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/fingerprint.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `lib/services/finance/fingerprint.ts`:

```ts
import { createHash } from "node:crypto"

import type { ParsedMovement } from "@/lib/services/finance/parsers/types"

export type Fingerprinted = ParsedMovement & { fingerprint: string }

/**
 * The identity of a movement, as far as a statement can express it.
 *
 * Two identical coffees on the same day share this on purpose — see rowsToWrite.
 * A provider's own transaction id, when the file carries one, makes it unique.
 *
 * @param accountId - the account the movement belongs to
 * @param movement - the movement as its reader produced it
 * @returns a hex digest, stable across imports
 */
export function fingerprintOf(
  accountId: string,
  movement: ParsedMovement
): string {
  const parts = [
    accountId,
    movement.date.toISOString().slice(0, 10),
    String(movement.amountCents),
    movement.description.toLowerCase().replace(/\s+/g, " ").trim(),
    movement.providerRef ?? "",
  ]

  // A null byte, because no field can contain one: joining on a character that
  // can appear in a description would let two different rows collide.
  return createHash("sha256").update(parts.join(" ")).digest("hex")
}

/**
 * Which of a file's rows are not already stored.
 *
 * Rows are **counted**, not compared. A file carrying three rows with one
 * fingerprint against two already stored contributes one — the third. Comparing
 * row against row would instead drop every repeat of an amount at a shop on a
 * day, which is a real outgoing vanishing without a trace.
 *
 * @param parsed - the file's rows, in the order the file wrote them
 * @param existing - how many rows each fingerprint already has, by fingerprint
 * @returns the rows to write with their occurrence numbers, and how many of the
 *   file's rows were already present
 */
export function rowsToWrite(
  parsed: readonly Fingerprinted[],
  existing: ReadonlyMap<string, number>
): { toWrite: (Fingerprinted & { occurrence: number })[]; skipped: number } {
  const seen = new Map<string, number>()
  const toWrite: (Fingerprinted & { occurrence: number })[] = []
  let skipped = 0

  for (const row of parsed) {
    const position = seen.get(row.fingerprint) ?? 0
    seen.set(row.fingerprint, position + 1)

    // Stored rows occupy occurrences 0 to already-1, so this row is new exactly
    // when its position in the file reaches past them.
    const already = existing.get(row.fingerprint) ?? 0
    if (position < already) {
      skipped++
      continue
    }

    toWrite.push({ ...row, occurrence: position })
  }

  return { toWrite, skipped }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/fingerprint.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/finance/fingerprint.ts lib/services/finance/fingerprint.test.ts
git commit -m "feat: duplicates are counted, not compared

Two coffees of 1,50 at the same bar on the same day share every field a
statement records, so row-against-row comparison skips the second and a
real outgoing disappears without a trace. Counting per fingerprint
writes what the file has beyond what the database holds, which is right
for the coffees and right for a re-import of an overlapping period.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Who sees which account, and what an account is worth

**Files:**

- Create: `lib/services/finance/access.ts`
- Create: `lib/services/finance/balance.ts`
- Create: `lib/services/finance/balance.test.ts`

**Interfaces:**

- Consumes: `db` from `lib/db.ts`.
- Produces:
  - `visibleAccountIds(actorId: string): Promise<string[]>`
  - `class AccountNotVisibleError extends Error`
  - `assertAccountVisible(actorId: string, accountId: string): Promise<void>`
  - `balanceCents(openingCents: number, openingAt: Date, movements: readonly { date: Date; amountCents: number }[]): number`

- [ ] **Step 1: Write the failing test for the arithmetic**

Create `lib/services/finance/balance.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { balanceCents } from "@/lib/services/finance/balance"

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe("balanceCents", () => {
  it("is the opening balance when nothing has moved", () => {
    expect(balanceCents(120000, day("2026-01-01"), [])).toBe(120000)
  })

  it("adds what came in and subtracts what went out", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2026-01-05"), amountCents: -4230 },
        { date: day("2026-01-06"), amountCents: 20000 },
      ])
    ).toBe(115770)
  })

  it("counts a movement dated the opening day itself", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2026-01-01"), amountCents: -1000 },
      ])
    ).toBe(99000)
  })

  it("ignores a movement before the opening balance, which already contains it", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2025-12-31"), amountCents: -1000 },
      ])
    ).toBe(100000)
  })

  it("handles a negative opening balance", () => {
    expect(
      balanceCents(-5000, day("2026-01-01"), [
        { date: day("2026-01-02"), amountCents: 8000 },
      ])
    ).toBe(3000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/balance.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the arithmetic**

Create `lib/services/finance/balance.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/balance.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the access rule**

Create `lib/services/finance/access.ts`:

```ts
import { db } from "@/lib/db"

/** Thrown when an account is asked for by someone who cannot see it. */
export class AccountNotVisibleError extends Error {
  constructor() {
    super("The account is not visible to this user.")
    this.name = "AccountNotVisibleError"
  }
}

/**
 * The accounts a user may see: their own, plus the shared ones.
 *
 * This is the module's whole authorisation rule. Every read and every write
 * starts here and filters inside its query — a check applied after a query has
 * already returned rows is the IDOR this exists to prevent.
 *
 * @param actorId - the user id, from the session and never from a payload
 * @returns their ids, in no particular order
 */
export async function visibleAccountIds(actorId: string): Promise<string[]> {
  const rows = await db.financeAccount.findMany({
    where: { OR: [{ ownerId: actorId }, { shared: true }] },
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

/**
 * Refuses when a user cannot see an account.
 *
 * @param actorId - the user id, from the session
 * @param accountId - the account being written to
 * @returns nothing
 * @throws AccountNotVisibleError when the account is invisible or absent
 */
export async function assertAccountVisible(
  actorId: string,
  accountId: string
): Promise<void> {
  const account = await db.financeAccount.findFirst({
    where: { id: accountId, OR: [{ ownerId: actorId }, { shared: true }] },
    select: { id: true },
  })

  if (account === null) throw new AccountNotVisibleError()
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm verify`
Expected: clean.

```bash
git add lib/services/finance/access.ts lib/services/finance/balance.ts lib/services/finance/balance.test.ts
git commit -m "feat: one function decides which accounts a person may see

Ownership is the module's only authorisation rule, so it lives in one
place and every query filters by what it returns. Scattering the check
across pages is how this architecture produces an IDOR.

The balance beside it is derived, never stored, and a movement dated
before the opening day is ignored — the opening balance already
contains it, and counting it twice would make the check useless.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Accounts, read and written

**Files:**

- Create: `lib/schemas/finance.ts`
- Create: `lib/schemas/finance.test.ts`
- Create: `lib/services/finance/accounts.ts`

**Interfaces:**

- Consumes: `visibleAccountIds`, `assertAccountVisible` (Task 6), `balanceCents`
  (Task 6).
- Produces:
  - `SignedEuroCentsSchema`, `FinanceAccountInputSchema`, `type FinanceAccountInput`, `FinanceAccountIdSchema`, `IsoDateSchema`
  - `type AccountSummary = { id: string; name: string; provider: FinanceProvider; shared: boolean; isOwn: boolean; balanceCents: number; lastMovementAt: Date | null }`
  - `listAccounts(actorId: string): Promise<AccountSummary[]>`
  - `getAccount(actorId: string, id: string): Promise<AccountDetail | null>`
  - `createAccount(actorId: string, input: FinanceAccountInput): Promise<string>`
  - `updateAccount(actorId: string, id: string, input: FinanceAccountInput): Promise<void>`

- [ ] **Step 1: Write the failing schema test**

Create `lib/schemas/finance.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  FinanceAccountInputSchema,
  SignedEuroCentsSchema,
} from "@/lib/schemas/finance"

describe("SignedEuroCentsSchema", () => {
  it("reads a plain amount", () => {
    expect(SignedEuroCentsSchema.parse("12,34")).toBe(1234)
  })

  it("reads a negative balance, which a current account can have", () => {
    expect(SignedEuroCentsSchema.parse("-12,34")).toBe(-1234)
  })

  it("accepts a dot, because a numeric keypad gives one", () => {
    expect(SignedEuroCentsSchema.parse("12.34")).toBe(1234)
  })

  it("treats an empty field as zero", () => {
    expect(SignedEuroCentsSchema.parse("")).toBe(0)
  })

  it("refuses a thousands separator rather than guessing at it", () => {
    expect(SignedEuroCentsSchema.safeParse("1.234,56").success).toBe(false)
  })

  it("refuses something that is not a number", () => {
    expect(SignedEuroCentsSchema.safeParse("boh").success).toBe(false)
  })
})

describe("FinanceAccountInputSchema", () => {
  // Keyed as the schema is, not as the form is: the field arrives as a typed
  // string and leaves as cents, and the action is what maps the form's
  // `openingBalance` onto it.
  const valid = {
    name: "Revolut",
    provider: "REVOLUT",
    shared: false,
    openingBalanceCents: "1200,00",
    openingBalanceAt: "2026-01-01",
  }

  it("accepts a filled-in form", () => {
    expect(FinanceAccountInputSchema.parse(valid).openingBalanceCents).toBe(
      120000
    )
  })

  it("refuses an empty name", () => {
    expect(
      FinanceAccountInputSchema.safeParse({ ...valid, name: " " }).success
    ).toBe(false)
  })

  it("refuses a provider that has no reader", () => {
    expect(
      FinanceAccountInputSchema.safeParse({ ...valid, provider: "PAYPAL" })
        .success
    ).toBe(false)
  })

  it("refuses a date that is not a date", () => {
    expect(
      FinanceAccountInputSchema.safeParse({
        ...valid,
        openingBalanceAt: "boh",
      }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/schemas/finance.test.ts`
Expected: FAIL — cannot resolve `@/lib/schemas/finance`.

- [ ] **Step 3: Write the schemas**

Create `lib/schemas/finance.ts`:

```ts
import { z } from "zod"

import { FinanceProvider } from "@/lib/generated/prisma/enums"

export const FinanceAccountIdSchema = z.cuid("Questo conto non è valido.")

export const MovementIdSchema = z.cuid("Questo movimento non è valido.")

export const FinanceProviderSchema = z.enum(
  FinanceProvider,
  "Scegli un servizio."
)

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
  .transform((value) => value.replace(",", "."))
  .refine((value) => value === "" || AMOUNT.test(value), {
    message: "Scrivi l’importo come 12,34, senza separatore delle migliaia.",
  })
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
  openingBalanceCents: SignedEuroCentsSchema,
  openingBalanceAt: IsoDateSchema,
})

export type FinanceAccountInput = z.infer<typeof FinanceAccountInputSchema>
```

The form posts a field named `openingBalance`; the schema's key is
`openingBalanceCents`, because that is what comes out of it. The action maps one
onto the other, the way `saveCatalogItem` maps its fields.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/schemas/finance.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Write the account service**

Create `lib/services/finance/accounts.ts`:

```ts
import type { FinanceProvider } from "@/lib/generated/prisma/enums"
import { db } from "@/lib/db"
import type { FinanceAccountInput } from "@/lib/schemas/finance"
import {
  AccountNotVisibleError,
  assertAccountVisible,
} from "@/lib/services/finance/access"
import { balanceCents } from "@/lib/services/finance/balance"

export type AccountSummary = {
  id: string
  name: string
  provider: FinanceProvider
  shared: boolean
  // Whether the actor owns it. Shown as a badge; never used to decide access,
  // which visibleAccountIds already did.
  isOwn: boolean
  balanceCents: number
  lastMovementAt: Date | null
}

export type AccountDetail = AccountSummary & {
  openingBalanceCents: number
  openingBalanceAt: Date
}

/**
 * Every account the user can see, with what it holds now.
 *
 * @param actorId - the user id, from the session
 * @returns the accounts, own ones first and then by name
 */
export async function listAccounts(actorId: string): Promise<AccountSummary[]> {
  const rows = await db.financeAccount.findMany({
    where: { OR: [{ ownerId: actorId }, { shared: true }] },
    select: {
      id: true,
      name: true,
      provider: true,
      shared: true,
      ownerId: true,
      openingBalanceCents: true,
      openingBalanceAt: true,
      movements: { select: { date: true, amountCents: true } },
    },
    orderBy: [{ name: "asc" }],
  })

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      shared: row.shared,
      isOwn: row.ownerId === actorId,
      balanceCents: balanceCents(
        row.openingBalanceCents,
        row.openingBalanceAt,
        row.movements
      ),
      lastMovementAt: row.movements.reduce<Date | null>(
        (latest, movement) =>
          latest === null || movement.date > latest ? movement.date : latest,
        null
      ),
    }))
    .sort((a, b) => Number(b.isOwn) - Number(a.isOwn))
}

/**
 * One account, or null when the user cannot see it.
 *
 * Null and not a throw: the page answers with notFound(), and saying "exists
 * but is not yours" would already be saying something.
 *
 * @param actorId - the user id, from the session
 * @param id - the account's id
 * @returns the account with its opening balance, or null
 */
export async function getAccount(
  actorId: string,
  id: string
): Promise<AccountDetail | null> {
  const row = await db.financeAccount.findFirst({
    where: { id, OR: [{ ownerId: actorId }, { shared: true }] },
    select: {
      id: true,
      name: true,
      provider: true,
      shared: true,
      ownerId: true,
      openingBalanceCents: true,
      openingBalanceAt: true,
      movements: { select: { date: true, amountCents: true } },
    },
  })

  if (row === null) return null

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    shared: row.shared,
    isOwn: row.ownerId === actorId,
    openingBalanceCents: row.openingBalanceCents,
    openingBalanceAt: row.openingBalanceAt,
    balanceCents: balanceCents(
      row.openingBalanceCents,
      row.openingBalanceAt,
      row.movements
    ),
    lastMovementAt: row.movements.reduce<Date | null>(
      (latest, movement) =>
        latest === null || movement.date > latest ? movement.date : latest,
      null
    ),
  }
}

/**
 * Opens an account, owned by whoever created it.
 *
 * @param actorId - the user id, from the session
 * @param input - the validated form
 * @returns the new account's id
 */
export async function createAccount(
  actorId: string,
  input: FinanceAccountInput
): Promise<string> {
  const created = await db.financeAccount.create({
    data: {
      name: input.name,
      provider: input.provider,
      shared: input.shared,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceAt: input.openingBalanceAt,
      ownerId: actorId,
    },
    select: { id: true },
  })

  return created.id
}

/**
 * Changes an account's name, provider, sharing or opening balance.
 *
 * The owner is never changed here: an account changing hands is not something
 * this app does, and allowing it from a form would make the ownership rule
 * editable by whoever can see the account.
 *
 * @param actorId - the user id, from the session
 * @param id - the account's id
 * @param input - the validated form
 * @returns nothing
 * @throws AccountNotVisibleError when the user cannot see the account
 */
export async function updateAccount(
  actorId: string,
  id: string,
  input: FinanceAccountInput
): Promise<void> {
  await assertAccountVisible(actorId, id)

  await db.financeAccount.update({
    where: { id },
    data: {
      name: input.name,
      provider: input.provider,
      shared: input.shared,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceAt: input.openingBalanceAt,
    },
  })
}

export { AccountNotVisibleError }
```

`listAccounts` loading every movement to sum a balance is fine at this size —
one household, three accounts, a few thousand rows — and it is the honest
implementation of "derived, never stored". If it ever becomes slow, the fix is a
grouped `aggregate` in this function and nowhere else.

- [ ] **Step 6: Verify and commit**

Run: `pnpm verify`
Expected: clean.

```bash
git add lib/schemas/finance.ts lib/schemas/finance.test.ts lib/services/finance/accounts.ts
git commit -m "feat: accounts, and the balance they derive rather than store

A balance may be negative here, unlike the shopping total: a current
account can be overdrawn and a schema refusing that would be unusable
exactly when it matters.

The owner is not editable. An account changing hands is not something
this app does, and a form that could do it would put the ownership rule
in reach of anyone who can see the account.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The import service

**Files:**

- Create: `lib/services/finance/import.ts`

**Interfaces:**

- Consumes: `readerFor`, `UnrecognisedFileError` (Task 4), `fingerprintOf`,
  `rowsToWrite` (Task 5), `assertAccountVisible` (Task 6).
- Produces:
  - `type ImportPreview = { accountName: string; rowsRead: number; unreadable: number; newCount: number; duplicateCount: number; periodFrom: Date | null; periodTo: Date | null }`
  - `type ImportOutcome = ImportPreview & { batchId: string }`
  - `previewImport(actorId: string, accountId: string, text: string): Promise<ImportPreview>`
  - `commitImport(actorId: string, accountId: string, fileName: string, text: string): Promise<ImportOutcome>`
  - `listImports(actorId: string, accountId?: string): Promise<ImportBatchSummary[]>`

- [ ] **Step 1: Write the service**

Create `lib/services/finance/import.ts`:

```ts
import { db } from "@/lib/db"
import { assertAccountVisible } from "@/lib/services/finance/access"
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
  const prepared = await prepare(actorId, accountId, text)

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
        // back to today so the column stays non-null and the history still says
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

  return {
    accountName: prepared.accountName,
    rowsRead: prepared.rowsRead,
    unreadable: prepared.unreadable,
    newCount: prepared.toWrite.length,
    duplicateCount: prepared.duplicateCount,
    periodFrom: prepared.periodFrom,
    periodTo: prepared.periodTo,
    batchId,
  }
}

/**
 * The recent imports, newest first, so "have I already loaded July" has an
 * answer.
 *
 * @param actorId - the user id, from the session
 * @returns the last fifty imports across the visible accounts
 */
export async function listImports(
  actorId: string
): Promise<ImportBatchSummary[]> {
  const rows = await db.importBatch.findMany({
    where: {
      account: { OR: [{ ownerId: actorId }, { shared: true }] },
    },
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
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm verify`
Expected: clean.

```bash
git add lib/services/finance/import.ts
git commit -m "feat: an import that says what it will do before it does it

The preview and the write share one prepare(), so they cannot disagree
about what the file says. The batch and its rows are one transaction —
a batch claiming coverage it never wrote would make the history lie —
and skipDuplicates leans on the unique index, so two imports racing
settle in Postgres instead of both believing they are first.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Movements, read

**Files:**

- Create: `lib/services/finance/movements.ts`
- Create: `lib/services/finance/movements.test.ts`

**Interfaces:**

- Consumes: `visibleAccountIds` (Task 6).
- Produces:
  - `const MOVEMENTS_PAGE_SIZE = 50`
  - `type MovementFilters = { accountId?: string; q?: string }`
  - `type MovementRow = { id: string; date: Date; amountCents: number; description: string; accountName: string }`
  - `type MovementPage = { rows: MovementRow[]; hasMore: boolean; nextOffset: number }`
  - `offsetFrom(raw: string | undefined): number`
  - `listMovements(actorId: string, filters: MovementFilters, offset: number): Promise<MovementPage>`
  - `getMovement(actorId: string, id: string): Promise<MovementDetail | null>`
  - `setMovementNote(actorId: string, id: string, note: string | null): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/movements.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { offsetFrom } from "@/lib/services/finance/movements"

describe("offsetFrom", () => {
  it("starts at zero when the address says nothing", () => {
    expect(offsetFrom(undefined)).toBe(0)
  })

  it("reads a number the address carries", () => {
    expect(offsetFrom("50")).toBe(50)
  })

  it("ignores a negative offset rather than paging backwards off the end", () => {
    expect(offsetFrom("-10")).toBe(0)
  })

  it("ignores something that is not a number", () => {
    expect(offsetFrom("boh")).toBe(0)
  })

  it("caps an absurd offset, so a hand-typed address cannot ask for a scan", () => {
    expect(offsetFrom("999999999")).toBe(100000)
  })

  it("floors a fractional offset", () => {
    expect(offsetFrom("50.7")).toBe(50)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/movements.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the service**

Create `lib/services/finance/movements.ts`:

```ts
import { db } from "@/lib/db"
import { visibleAccountIds } from "@/lib/services/finance/access"

// Three accounts produce roughly two thousand movements a year, and every
// filter change re-runs the query. Fifty is a screenful and a half.
export const MOVEMENTS_PAGE_SIZE = 50

// Far past any real history, and near enough that a hand-typed offset cannot
// ask Postgres to skip a hundred million rows.
const MAX_OFFSET = 100_000

export type MovementFilters = { accountId?: string; q?: string }

export type MovementRow = {
  id: string
  date: Date
  amountCents: number
  description: string
  accountName: string
}

export type MovementPage = {
  rows: MovementRow[]
  hasMore: boolean
  nextOffset: number
}

export type MovementDetail = MovementRow & {
  accountId: string
  providerCategory: string | null
  providerRef: string | null
  note: string | null
  importedAt: Date | null
  importFileName: string | null
}

/**
 * How far into the list an address is asking to start.
 *
 * @param raw - the offset search param, as Next delivered it
 * @returns a whole number between zero and the cap
 */
export function offsetFrom(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(Math.floor(parsed), MAX_OFFSET)
}

/**
 * A page of movements, newest first, across the accounts the user can see.
 *
 * Not bound to a month: the summary is where a month is the unit, and making
 * the list ask for one would mean guessing the month before searching for a
 * payment.
 *
 * @param actorId - the user id, from the session
 * @param filters - the account and the text typed, both optional
 * @param offset - how many rows to skip
 * @returns the page, and whether another one follows
 */
export async function listMovements(
  actorId: string,
  filters: MovementFilters,
  offset: number
): Promise<MovementPage> {
  const visible = await visibleAccountIds(actorId)

  // An account filter naming something invisible narrows to nothing rather than
  // widening to everything: the intersection is the safe direction.
  const accountIds =
    filters.accountId === undefined
      ? visible
      : visible.filter((id) => id === filters.accountId)

  if (accountIds.length === 0) {
    return { rows: [], hasMore: false, nextOffset: offset }
  }

  const query = filters.q?.trim() ?? ""

  const rows = await db.movement.findMany({
    where: {
      accountId: { in: accountIds },
      ...(query === ""
        ? {}
        : { description: { contains: query, mode: "insensitive" as const } }),
    },
    select: {
      id: true,
      date: true,
      amountCents: true,
      description: true,
      account: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: offset,
    // One more than the page, so "is there another page" needs no second query.
    take: MOVEMENTS_PAGE_SIZE + 1,
  })

  const page = rows.slice(0, MOVEMENTS_PAGE_SIZE)

  return {
    rows: page.map((row) => ({
      id: row.id,
      date: row.date,
      amountCents: row.amountCents,
      description: row.description,
      accountName: row.account.name,
    })),
    hasMore: rows.length > MOVEMENTS_PAGE_SIZE,
    nextOffset: offset + MOVEMENTS_PAGE_SIZE,
  }
}

/**
 * One movement, or null when the user cannot see its account.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @returns the movement with what the provider said and what was decided, or
 *   null
 */
export async function getMovement(
  actorId: string,
  id: string
): Promise<MovementDetail | null> {
  const row = await db.movement.findFirst({
    where: {
      id,
      account: { OR: [{ ownerId: actorId }, { shared: true }] },
    },
    select: {
      id: true,
      date: true,
      amountCents: true,
      description: true,
      providerCategory: true,
      providerRef: true,
      note: true,
      accountId: true,
      account: { select: { name: true } },
      importBatch: { select: { createdAt: true, fileName: true } },
    },
  })

  if (row === null) return null

  return {
    id: row.id,
    date: row.date,
    amountCents: row.amountCents,
    description: row.description,
    accountId: row.accountId,
    accountName: row.account.name,
    providerCategory: row.providerCategory,
    providerRef: row.providerRef,
    note: row.note,
    importedAt: row.importBatch?.createdAt ?? null,
    importFileName: row.importBatch?.fileName ?? null,
  }
}

/**
 * Writes the owner's own remark on a movement.
 *
 * The only field of a movement that may be written. The imported ones are not:
 * correcting a description would make the next import of that period see an
 * unrecognised row and write it again beside the correction.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @param note - the remark, or null to clear it
 * @returns nothing
 */
export async function setMovementNote(
  actorId: string,
  id: string,
  note: string | null
): Promise<void> {
  // updateMany with the visibility in the filter: an id the user cannot see
  // matches nothing and writes nothing, with no second round trip to check.
  await db.movement.updateMany({
    where: {
      id,
      account: { OR: [{ ownerId: actorId }, { shared: true }] },
    },
    data: { note },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/movements.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify and commit**

Run: `pnpm verify`

```bash
git add lib/services/finance/movements.ts lib/services/finance/movements.test.ts
git commit -m "feat: the movements, filtered and paged from the address bar

The list is the whole history and not a month: the summary is where a
month is the unit, and a list bound to one would make you guess the
month before searching for a payment.

An account filter naming an invisible account narrows to nothing rather
than widening to everything, and the note is the only field of a
movement anyone may write.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The accounts screens

**Files:**

- Create: `app/(app)/finance/accounts/page.tsx`
- Create: `app/(app)/finance/accounts/actions.ts`
- Create: `app/(app)/finance/accounts/new/page.tsx`
- Create: `app/(app)/finance/accounts/[id]/edit/page.tsx`
- Create: `components/finance/account-form.tsx`
- Create: `app/(app)/finance/accounts/error.tsx`
- Create: `app/(app)/finance/accounts/loading.tsx`

**Interfaces:**

- Consumes: `listAccounts`, `getAccount`, `createAccount`, `updateAccount`
  (Task 7), `FinanceAccountInputSchema`, `FinanceAccountIdSchema` (Task 7).
- Produces: the routes `/finance/accounts`, `/finance/accounts/new`,
  `/finance/accounts/[id]/edit`, and `saveFinanceAccount: FormAction`.

Follow the existing pattern exactly: `app/(app)/catalog/` for the list, the
`new` and `[name]/edit` pages and `actions.ts`; `components/catalog/` for the
form component. Read those four files before writing these.

- [ ] **Step 1: Write the form component**

`components/finance/account-form.tsx` is a client component built from
`PageForm`, `TextField`, `SelectField` and a checkbox for `shared`, following
`components/catalog/`'s form. Its fields:

| Field name         | Control                    | Label                       |
| ------------------ | -------------------------- | --------------------------- |
| `name`             | `TextField`                | Nome                        |
| `provider`         | `SelectField`              | Servizio                    |
| `openingBalance`   | `TextField`, `inputMode="decimal"` | Saldo iniziale      |
| `openingBalanceAt` | `TextField`, `type="date"` | Alla data                   |
| `shared`           | `Checkbox`                 | Visibile anche all'altra persona |

The provider select needs an `items` map, not a list — the standing decision of
2026-08-18: a Base UI `Select` whose values differ from its labels renders the
raw value without one, and this one would read `REVOLUT` on screen.

```tsx
const PROVIDERS = {
  SATISPAY: "Satispay",
  REVOLUT: "Revolut",
  INTESA: "Intesa Sanpaolo",
} as const
```

Below the balance field, as its `description`: «Il saldo del conto a quella
data. Da qui in poi lo calcola l'app.»

- [ ] **Step 2: Write the action**

`app/(app)/finance/accounts/actions.ts`, following `catalog/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"

import { requireSession } from "@/lib/auth"
import { failure, type FormAction } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import {
  FinanceAccountIdSchema,
  FinanceAccountInputSchema,
} from "@/lib/schemas/finance"
import { AccountNotVisibleError } from "@/lib/services/finance/access"
import { createAccount, updateAccount } from "@/lib/services/finance/accounts"

const FORM_FIELDS = [
  "id",
  "name",
  "provider",
  "openingBalance",
  "openingBalanceAt",
  "shared",
] as const

export const saveFinanceAccount: FormAction = async (_state, formData) => {
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

  const parsed = FinanceAccountInputSchema.safeParse({
    name: formData.get("name") ?? "",
    provider: formData.get("provider") ?? "",
    // An unticked checkbox posts nothing at all, so the absence is what means
    // false. The schema stays honest about having been handed a boolean.
    shared: formData.get("shared") !== null,
    openingBalanceCents: formData.get("openingBalance") ?? "",
    openingBalanceAt: formData.get("openingBalanceAt") ?? "",
  })

  if (!parsed.success) {
    return refuse("Controlla i campi segnalati.", fieldErrorsFrom(parsed.error))
  }

  const { userId } = await requireSession()

  const rawId = formData.get("id")
  const id =
    typeof rawId === "string" && rawId !== ""
      ? FinanceAccountIdSchema.safeParse(rawId)
      : null

  try {
    if (id === null) {
      await createAccount(userId, parsed.data)
    } else if (id.success) {
      await updateAccount(userId, id.data, parsed.data)
    } else {
      return refuse("Questo conto non esiste più.")
    }
  } catch (error) {
    if (error instanceof AccountNotVisibleError) {
      return refuse("Questo conto non esiste più.")
    }
    throw error
  }

  revalidatePath("/finance")
  revalidatePath("/finance/accounts")
  redirect("/finance/accounts", RedirectType.replace)
}
```

- [ ] **Step 3: Write the three pages**

`/finance/accounts` — `ListBody`, `PageHeader title="Conti"` with a «Nuovo»
button, and a `DataList` of `DataListRow`s linking to the edit page. Each row's
title is the account name; beneath it a `Badge` with the provider's label, the
balance from `formatEuro`, «condiviso» when shared, and «ultimo movimento: …» or
«nessun movimento» — the last of these is what tells you an account has never
been imported.

Empty state: title «Nessun conto.», description «Aggiungi il primo conto per
cominciare a importare i movimenti.», with a «Nuovo conto» button.

`/finance/accounts/new` and `/finance/accounts/[id]/edit` render
`AccountForm`; the edit page calls `getAccount` and `notFound()` on null. Add
`error.tsx` and `loading.tsx` copied in shape from `app/(app)/catalog/`.

The edit page must format the opening balance back into the field as the form
expects it — `(cents / 100).toFixed(2).replace(".", ",")` — and the date as
`toISOString().slice(0, 10)`.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/finance/accounts" components/finance/account-form.tsx
git commit -m "feat: the screens that open an account

The row says when the last movement arrived, or that none ever has —
which is the fastest way to notice a conto nobody has imported since
June.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: The movements list and the detail

**Files:**

- Create: `app/(app)/finance/movements/page.tsx`
- Create: `app/(app)/finance/movements/[id]/page.tsx`
- Create: `app/(app)/finance/movements/[id]/actions.ts`
- Create: `app/(app)/finance/movements/error.tsx`
- Create: `app/(app)/finance/movements/loading.tsx`
- Create: `app/(app)/finance/movements/[id]/loading.tsx`
- Create: `app/(app)/finance/movements/[id]/not-found.tsx`
- Create: `components/finance/movement-amount.tsx`

**Interfaces:**

- Consumes: `listMovements`, `getMovement`, `setMovementNote`, `offsetFrom`
  (Task 9), `listAccounts` (Task 7).
- Produces: the routes `/finance/movements` and `/finance/movements/[id]`.

- [ ] **Step 1: Write the amount component**

`components/finance/movement-amount.tsx` — a server component, because it holds
no state:

```tsx
import { formatEuro } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * An amount, with the sign carried by more than colour.
 */
export function MovementAmount({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        // Colour is the second signal, never the only one: the minus sign that
        // formatEuro renders is the first, and it survives a monochrome screen
        // and every kind of colour blindness.
        cents < 0 ? "text-foreground" : "text-emerald-700 dark:text-emerald-400",
        className
      )}
    >
      {formatEuro(cents)}
    </span>
  )
}
```

- [ ] **Step 2: Write the list page**

`/finance/movements`, following `app/(app)/catalog/page.tsx` closely:

- `searchParams` typed as `Promise<{ q?: string | string[]; account?: string | string[]; offset?: string | string[] }>`, narrowed with `firstOf`.
- `SearchField basePath="/finance/movements" placeholder="Cerca un movimento…" label="Cerca un movimento"`, inside `<Suspense>`.
- `FilterChips param="account"` with `{ value: undefined, label: "Tutti" }` and one chip per visible account, `keep={{ q }}`.
- `DataList` of `DataListRow` linking to `/finance/movements/${id}`, title the description, and beneath it the date (`toLocaleDateString("it-IT", { day: "numeric", month: "short" })`), the account name, and `MovementAmount`.
- When `page.hasMore`, a link below the list labelled «Mostra altri» pointing at the same address with `offset` set to `page.nextOffset` and `q` and `account` preserved.

Empty states, three of them, the way the catalogue distinguishes its three:
searching → «Nessun movimento con questo testo.»; filtered by account →
«Nessun movimento su questo conto.»; neither → «Nessun movimento.» with a
description «Importa un estratto conto per cominciare.» and a button to
`/finance/import`.

**Do not change `FilterChips`.** With at most four accounts its single row fits.
The horizontal scroll §9.2 of the spec calls for is needed by the category
filter, which is the next plan's.

- [ ] **Step 3: Write the detail page and its action**

`/finance/movements/[id]`:

- `DetailBody`, `PageHeader` with the description as the title, `back` pointing
  at `/finance/movements` labelled «Movimenti», and the subtitle holding the
  date, the account and `MovementAmount`.
- A first section, «Come è arrivato»: the date, the amount, the account, the
  provider's own category when there is one, and «importato il … da <file>».
  Read-only, with a line saying so: «Questi dati arrivano dal file e non si
  modificano.»
- A second section, «Le tue note», holding a form with a `TextareaField` named
  `note` and a save button.

The action, in `[id]/actions.ts`, validates with `MovementIdSchema` and a note
schema (`z.string().trim().max(500)`, empty meaning null), calls
`requireSession()`, then `setMovementNote`, then `revalidatePath`. It returns
`success("Nota salvata.")` rather than redirecting — the page stays open.

`not-found.tsx` uses `MessagePage`, like `app/(app)/recipes/[id]/not-found.tsx`.

- [ ] **Step 4: Verify**

Run: `pnpm verify`

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/finance/movements" components/finance/movement-amount.tsx
git commit -m "feat: the whole history, searchable, and one movement in full

The detail shows what the file said and what you decided as two
sections, because only the second is editable — correcting an imported
description would make the next import of that period write the
original back beside it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: The import screen

**Files:**

- Create: `app/(app)/finance/import/page.tsx`
- Create: `app/(app)/finance/import/actions.ts`
- Create: `components/finance/import-panel.tsx`
- Create: `app/(app)/finance/import/error.tsx`
- Create: `app/(app)/finance/import/loading.tsx`

**Interfaces:**

- Consumes: `previewImport`, `commitImport`, `listImports` (Task 8),
  `listAccounts` (Task 7).
- Produces: the route `/finance/import`, and the two server actions
  `previewStatement` and `importStatement`.

- [ ] **Step 1: Write the actions**

`app/(app)/finance/import/actions.ts`. These are not `FormAction`s — they take
typed arguments and return a typed result, because the panel calls them from
its own state rather than from a `<form>`:

```ts
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
// actions have a body limit that a bigger payload would hit as an opaque error.
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
  | { ok: true; preview: ImportPreview }
  | { ok: true; outcome: ImportOutcome }
  | { ok: false; message: string; expected?: string[]; found?: string[] }

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
  const parsed = StatementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Scegli un conto e un file valido." }
  }

  const { userId } = await requireSession()

  try {
    return {
      ok: true,
      preview: await previewImport(userId, parsed.data.accountId, parsed.data.text),
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
    return { ok: true, outcome }
  } catch (error) {
    return refuse(error)
  }
}
```

Both actions validate before they authenticate and authorise, in that order, and
both are reachable directly — which is why the schema is not optional.

- [ ] **Step 2: Write the panel**

`components/finance/import-panel.tsx`, a client component. Its state machine has
four states: `choosing`, `previewing`, `writing`, `done`. It holds the file's
text in state between the preview and the write, which is what lets the preview
exist at all — a file input cannot be re-submitted after a round trip.

Behaviour:

1. A `SelectField` of the visible accounts, and an `<input type="file" accept=".csv,text/csv">`.
2. On choosing a file: refuse over 1 MB before reading it, then `file.text()`,
   then call `previewStatement` inside `useTransition`.
3. On a preview: show «<conto> — dal <data> al <data>», then «N movimenti
   nuovi», «N già presenti», and «N righe illeggibili» only when that number is
   not zero, styled as a warning. Two buttons: «Importa» and «Annulla».
4. On a refusal carrying `expected` and `found`: print both lists, so the
   mismatch is diagnosable without a developer.
5. On success: «Importati N movimenti», with links to `/finance/movements` and
   `/finance`.

Use `Alert` from `components/ui/` for the refusal and the warning. If the
project has no `Alert`, compose one from `Card` rather than adding a component
from anywhere but shadcn.

- [ ] **Step 3: Write the page**

`/finance/import` — a server component: `ListBody`, `PageHeader title="Importa"`
with the subtitle «Carica l'estratto conto esportato dal servizio.», the
`ImportPanel` with the visible accounts passed in, and below it a
`ListSection title="Import recenti"` holding `listImports`, each row reading
«<conto> — <file>, N movimenti, <data>».

When there are no accounts, render an `EmptyState` offering
`/finance/accounts/new` instead of the panel: importing into nothing is not a
state worth designing a form for.

- [ ] **Step 4: Verify**

Run: `pnpm verify`

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/finance/import" components/finance/import-panel.tsx
git commit -m "feat: the import, with the preview it promised

The file is read in the browser and posted as text, because the preview
needs the same file across two round trips and a file input cannot be
re-submitted after one. Nothing is stored between them.

A file from the wrong provider prints the columns it wanted beside the
columns it found — which is how the first real Intesa and Satispay
exports will correct the readers built on a guess.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Turning the module on

**Files:**

- Create: `app/(app)/finance/page.tsx`
- Create: `app/(app)/finance/error.tsx`
- Create: `app/(app)/finance/loading.tsx`
- Modify: `lib/modules.ts` — the second entry
- Modify: `lib/modules.test.ts` — the registry assertions
- Modify: `app/layout.tsx:16-17` — the app-wide title and description
- Modify: `app/manifest.ts` — `start_url`
- Modify: `docs/superpowers/specs/2026-08-23-finance-design.md` — §2.1, §4.2, §5.3

**Interfaces:**

- Consumes: `listAccounts` (Task 7), `MODULES` (previous plan).
- Produces: the route `/finance`, and the fork's second card.

- [ ] **Step 1: Write the finance landing page**

`/finance` — this plan's version. §9.1's month, categories and comparisons are
the next plan's; what belongs here is the balances and the way in.

- `ListBody`, `PageHeader title="Finanza"`.
- A `ListSection title="Saldi"` with one `Card` per account: name, balance from
  `formatEuro`, and «aggiornato al <ultimo movimento>» or «nessun movimento».
  Below them a row with the total across the visible accounts.
- A `ListSection title="Vai a"` with three `DataListRow`s: «Movimenti» →
  `/finance/movements`, «Importa» → `/finance/import`, «Conti» →
  `/finance/accounts`.
- With no visible accounts, an `EmptyState`: title «Nessun conto.», description
  «Aggiungi il primo conto, poi importa l'estratto che il servizio esporta.»,
  and a button to `/finance/accounts/new`.

Add the section header comment naming what is deliberately absent:

```tsx
// The month, the categories and the comparison with the last three months are
// the next plan's — design document §9.1. What is here is what plan 2 can
// honestly show: what each account holds, and the three ways in.
```

- [ ] **Step 2: Add the module to the registry**

In `lib/modules.ts`, append to `MODULES`:

```ts
  {
    id: "finance",
    label: "Finanza",
    description: "I movimenti dei conti, in un posto solo.",
    href: "/finance",
    nav: [
      { href: "/finance", label: "Riepilogo" },
      { href: "/finance/movements", label: "Movimenti" },
      { href: "/finance/import", label: "Importa" },
    ],
  },
```

**The module is visible to everyone**, and there is no account check. With no
accounts nobody could see the module, and the only place to create the first
account is inside it. `/finance` with nothing to show is not an empty room: it
offers to add the first account. Per-account authorisation is untouched and is
where the privacy actually is.

- [ ] **Step 3: Update the registry test**

In `lib/modules.test.ts`, replace the first `MODULES` assertion and add a
second:

```ts
  it("declares the menu module first", () => {
    expect(MODULES[0]?.id).toBe("menu")
  })

  it("declares the finance module", () => {
    expect(MODULES.map((module) => module.id)).toContain("finance")
  })

  it("sends the fork somewhere for every module", () => {
    for (const module of MODULES) {
      expect(module.href.startsWith("/")).toBe(true)
      expect(module.nav.length).toBeGreaterThan(0)
    }
  })
```

- [ ] **Step 4: Give the app back its own name**

`app/layout.tsx` carries `title: "Menù e spesa"` app-wide. That was the app's
name when it had one module; it is now the name of one of two, and a finance
page falling back to it would be wrong. `app/manifest.ts` already says so in a
comment — follow it.

```ts
export const metadata: Metadata = {
  title: "Personal Productivity",
  description: "Menù, spesa e finanze personali",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-icon-180.png",
  },
}
```

And in `app/manifest.ts`, `start_url` becomes `"/"` — the fork is now the right
place to land, and it redirects onwards by itself when there is only one module
to choose. Update the manifest's `description` to match the metadata.

- [ ] **Step 5: Record the two amendments in the spec**

In `docs/superpowers/specs/2026-08-23-finance-design.md`:

- **§2.1** — replace the paragraph making the Finanza card conditional on
  seeing an account with the decision above and its reason, keeping the
  redirect-when-sole rule intact.
- **§5.1** — add that the file is read in the browser and posted as text, with
  the 1 MB refusal, and why: the preview needs the same file across two round
  trips.
- **§4.2** — the row claiming Revolut carries a transaction id: its statement
  CSV does not. Reword to "when the file carries one; of the three, only
  Satispay's export is expected to", and keep §5.3's counting as the general
  case rather than the fallback.

- [ ] **Step 6: Verify the whole gate**

Run: `pnpm verify`
Expected: typecheck, lint and tests all clean.

- [ ] **Step 7: Commit**

```bash
git add lib/modules.ts lib/modules.test.ts "app/(app)/finance/page.tsx" "app/(app)/finance/error.tsx" "app/(app)/finance/loading.tsx" app/layout.tsx app/manifest.ts docs/superpowers/specs/2026-08-23-finance-design.md
git commit -m "feat: the fork has a second door

The registry gains its second entry, so `/` stops redirecting and
becomes the choice it was built to be, and the panel grows its
headings.

The module is visible to everyone rather than to whoever already has an
account: the only place to create the first account is inside it, so
hiding it until one exists locks everybody out. Per-account
authorisation is untouched, and that is where the privacy is.

The app takes its own name back in the tab. "Menù e spesa" was the app
when it had one module; it is now one of two, and app/manifest.ts had
already written down why.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Manual checklist

At 390 px, signed in. Walk it by hand or through the `playwright` MCP server.

**The way in**

1. `/` shows two cards, «Menù e spesa» and «Finanza». Tapping the second lands
   on `/finance`.
2. The panel shows three headings — «Menù e spesa», «Finanza», and «App» for the
   owner — with Riepilogo, Movimenti and Importa under the second.
3. On `/finance/movements`, «Movimenti» carries `aria-current="page"` and
   «Riepilogo» does not.
4. The browser tab on a finance page does not read «Menù e spesa».

**Accounts**

5. With no accounts, `/finance` offers to add the first one and does not show an
   empty balances section.
6. Creating an account with name «Revolut», provider Revolut, opening balance
   `1200,00` at a date, lands back on the list showing `1.200,00 €` and «nessun
   movimento».
7. The provider select shows «Intesa Sanpaolo», not `INTESA`.
8. `1.234,56` in the opening balance is refused with the message about the
   thousands separator, and the typed value is still in the field.
9. Editing the account shows the balance back as `1200,00` and the date in the
   date field.

**Import**

10. `/finance/import` with a Revolut CSV shows the preview before writing:
    account, period, «N nuovi», «N già presenti». Nothing is in
    `/finance/movements` yet.
11. Confirming writes them, and the outcome links to the movements.
12. **Importing the same file again reports every row as already present and
    writes nothing.** The movement count on the list does not change.
13. Loading that same file against an account whose provider is Intesa is
    refused, and the screen prints the columns expected and the columns found.
14. The recent imports list shows both attempts, newest first.

**Movements**

15. The list shows the newest first, with date, account and amount on each row.
    An outgoing carries a minus sign, not only a colour.
16. Typing in the search narrows the list and the address bar gains `?q=`.
    Reloading keeps the filter.
17. Tapping an account chip narrows further and keeps `q`.
18. With more than fifty movements, «Mostra altri» appears and loads the next
    fifty; the address carries the offset.
19. Opening a movement shows the provider's data as read-only, with the line
    saying so, and the note field below it. Saving a note keeps you on the page
    and says «Nota salvata.»
20. Editing the address to a movement id on an account you cannot see answers the
    not-found screen, not the movement.

**The balance as a check**

21. After the import, the account's balance equals the opening balance plus the
    sum of what arrived. Compare it against what Revolut's own app shows for the
    same date: a difference means the import has a hole, and that is what this
    number is for.

## What this plan does not do

- **No categories, no rules, no transfers, no summary.** All of it is plan 3.
- **No `FilterChips` change.** Its single row fits four accounts; the horizontal
  scroll is needed by the category filter, which plan 3 adds.
- **No roadmap update**, for as long as `fix/execution-history-foreign-key` holds
  an unmerged correction to that file.
- **No spreadsheet dependency.** If the real Intesa export is XLSX only, it is
  saved as CSV by hand until that is discussed.
