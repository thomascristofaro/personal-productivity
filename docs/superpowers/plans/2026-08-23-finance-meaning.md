# Finance Meaning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the imported money answer the owner's two questions — where it
went, and whether this month is worse than usual — by giving every movement a
category, and by turning the pairs that are not really income or spending into
transfers.

**Architecture:** the same shape as the core plan. Every decision is a pure
function under `lib/services/finance/` — which rule matches, which pairs are
candidates, what a month adds up to, what the mean of the last three is — and
the database functions are thin wrappers. The screens are thin callers built
from `components/page/`, which after the refactor of 2026-08-23 has the shapes
this plan needs.

**Tech Stack:** Prisma 7 with the `pg` driver adapter, Next.js App Router server
components and server actions, Zod, shadcn/Base UI, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-23-finance-design.md`](../specs/2026-08-23-finance-design.md)
— §6, §7, §8.2, §8.3, §9.1 to §9.3, §9.5, and §12 "Plan 3".

## Global Constraints

- **`lib/services/` is the backend.** No imports from `app/`, `components/` or
  `hooks/`; no React, no `next/*`; no `Request`, `Response`, `cookies()` or
  `headers()`. ESLint fails `pnpm verify` on a violation.
- **`actorId` is reserved**: an identity the caller already verified from the
  session, never a value from a payload. ESLint rejects the name in
  `lib/schemas/`.
- **Every read and every write filters by `visibleTo(actorId)`** from
  `lib/services/finance/access.ts`. A category or a rule is household-wide; a
  **movement** is not, and every query that touches one carries that filter.
- **Zod validates every external input**, at the route handler and inside every
  server action. Validate, then authenticate, then authorise, then mutate.
- **Money is integer cents.** `lib/money.ts` formats; parsing lives in
  `lib/schemas/`.
- **Calendar dates use `@db.Date`**, produced through `APP_TIMEZONE` the way
  `lib/week.ts` does it.
- **Italian for what the user reads**; English for identifiers, comments, TSDoc,
  file names, test names, commit messages. URL segments and search params are
  English.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary,
  `@param`, `@returns`, `@throws`. ESLint enforces it.
- **Use the component library; do not rebuild it.** `DataList`, `CardList`,
  `DataListRow`, `DataRow`, `DetailSection`, `ListSection`, `EmptyState`,
  `SearchField`, `FilterChips`, `PageForm`, `FormActions`, `FormMessage`,
  `TextField`, `SelectField`, `TextareaField`, `Alert`. A base component that
  is missing comes from shadcn, never from hand-written markup. This plan was
  written after a refactor that existed because these were bypassed once.
- **Tests run in `environment: "node"`.** No component tests. Assert pure
  functions; verify screens in the browser against the checklist at the end.
- **`pnpm verify` before claiming anything works.**
- Commit messages in English, ending with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Decisions taken while writing this plan

**Categories and rules are household-wide, not per user.** They are a shared
vocabulary: two people looking at the same movement should see the same word for
it. Accounts stay owned — §3 is untouched, and it is movements that carry the
privacy.

**Categories are seeded.** The transfer confirmation of §7.2 needs a `TRANSFER`
category to exist before anybody can use the screen, and a first session that
begins by inventing twelve categories from nothing is a session that does not
happen. The seed is idempotent, like the rest of `prisma/seed.ts`.

**A categories screen exists**, which the spec does not name. Without one the
seeded list is frozen, and it will be wrong within a fortnight. It is small —
name, kind, archive — and it is reached from the summary and from the rules
screen, not from the nav. The nav stays at three entries per §2.2.

**The category, the rule and the backfill are one form, not a wizard.** §6.2
describes three questions in sequence; asked one round trip at a time they are
three screens for what is one decision. The detail screen asks them together:
the category, whether to remember it as a rule with the token prefilled, and
whether to apply it backwards. One submit, one message saying what happened.

---

### Task 1: The schema, and a vocabulary to start from

**Files:**

- Modify: `prisma/schema.prisma`
- Create: the migration `prisma/migrations/<timestamp>_finance_meaning/`
- Create: `prisma/categories.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**

- Consumes: `Movement`, `FinanceAccount` from the core plan.
- Produces: `CategoryKind`, `CategorySource`, `RuleKind`, `Category`,
  `CategoryRule`, `TransferLink`, and `Movement.categoryId` /
  `Movement.categorySource` on the Prisma client.

- [ ] **Step 1: Add the models**

In `prisma/schema.prisma`, after the `ImportBatch` model:

```prisma
enum CategoryKind {
  EXPENSE
  INCOME
  TRANSFER
}

// Who decided a movement's category. It exists to protect a decision: without
// it, the first "apply this rule to the past too" silently overwrites an
// afternoon of manual corrections.
enum CategorySource {
  NONE
  MANUAL
  RULE
  PROVIDER_MAP
  TRANSFER_LINK
}

enum RuleKind {
  DESCRIPTION_CONTAINS
  PROVIDER_CATEGORY_IS
}

// Household-wide, not per user: two people looking at one movement should see
// the same word for it. Accounts stay owned — the privacy is on the movement.
model Category {
  id        String       @id @default(cuid())
  // Italian, because it is data.
  name      String       @unique
  kind      CategoryKind
  sortOrder Int          @default(0)
  // Hidden from pickers, kept on old movements. Deleting would either orphan
  // history or recategorise it, and both rewrite the past.
  archived  Boolean      @default(false)
  createdAt DateTime     @default(now())

  movements Movement[]
  rules     CategoryRule[]

  @@index([archived, sortOrder])
}

// Ordered, first match wins: a specific rule written today has to beat a general
// one written in March without anyone rewriting the general one.
model CategoryRule {
  id         String   @id @default(cuid())
  kind       RuleKind
  // A substring for DESCRIPTION_CONTAINS, the provider's own category verbatim
  // for PROVIDER_CATEGORY_IS. Never a regular expression: one in this field is
  // something the owner would have to debug from a phone.
  pattern    String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  priority   Int      @default(0)
  // Null means every account.
  accountId  String?
  account    FinanceAccount? @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@index([priority])
  @@index([accountId])
}

// A row per pair, not a column on each movement. Both sides unique, so a
// movement belongs to at most one link and unlinking frees both legs at once.
model TransferLink {
  id               String   @id @default(cuid())
  fromMovementId   String   @unique
  fromMovement     Movement @relation("TransferFrom", fields: [fromMovementId], references: [id], onDelete: Cascade)
  toMovementId     String   @unique
  toMovement       Movement @relation("TransferTo", fields: [toMovementId], references: [id], onDelete: Cascade)
  confirmedAt      DateTime @default(now())
}
```

- [ ] **Step 2: Give `Movement` its category**

In `model Movement`, after `providerRef`:

```prisma
  categoryId     String?
  category       Category?      @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categorySource CategorySource @default(NONE)
```

and after `createdAt`, the two back-relations `TransferLink` needs:

```prisma
  transferFrom TransferLink? @relation("TransferFrom")
  transferTo   TransferLink? @relation("TransferTo")
```

and add `@@index([categoryId])` beside the existing indexes.

In `model FinanceAccount`, add the back-relation `rules CategoryRule[]`.

- [ ] **Step 3: Write the starting vocabulary**

Create `prisma/categories.ts`:

```ts
// The list the household starts from, not the list it ends with — the
// categories screen edits it. Order is the order they appear in a picker.
//
// Exactly one TRANSFER: confirming a pair sets both movements to it, so the
// module cannot work without it, and two of them would make "which one" a
// question nobody should have to answer.
export const CATEGORIES = [
  { name: "Spesa", kind: "EXPENSE" },
  { name: "Ristoranti e bar", kind: "EXPENSE" },
  { name: "Casa e bollette", kind: "EXPENSE" },
  { name: "Trasporti", kind: "EXPENSE" },
  { name: "Salute", kind: "EXPENSE" },
  { name: "Abbonamenti", kind: "EXPENSE" },
  { name: "Tempo libero", kind: "EXPENSE" },
  { name: "Acquisti", kind: "EXPENSE" },
  { name: "Contanti", kind: "EXPENSE" },
  { name: "Altre uscite", kind: "EXPENSE" },
  { name: "Stipendio", kind: "INCOME" },
  { name: "Altre entrate", kind: "INCOME" },
  { name: "Trasferimento", kind: "TRANSFER" },
] as const
```

- [ ] **Step 4: Seed them**

In `prisma/seed.ts`, add the import and an upsert loop beside the existing ones:

```ts
import { CATEGORIES } from "./categories"
```

```ts
  // Keyed on the name, like the catalogue: running the seed again renames
  // nothing and adds nothing. A category the owner has since renamed comes back
  // as a new one, which is the same trade the catalogue already makes.
  for (const [index, category] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { name: category.name },
      update: {},
      create: { ...category, sortOrder: index },
    })
  }
```

- [ ] **Step 5: Name the kinds once, where Zod can reach them**

The Prisma enum is not importable from `lib/schemas/`, which may import Zod and
its own siblings and nothing else — the rule `CATALOG_ITEM_KINDS` already
follows. Append to `lib/schemas/finance.ts`:

```ts
export const CATEGORY_KINDS = ["EXPENSE", "INCOME", "TRANSFER"] as const
export const CategoryKindSchema = z.enum(CATEGORY_KINDS, "Scegli un tipo.")
export type CategoryKind = z.infer<typeof CategoryKindSchema>

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  EXPENSE: "Uscita",
  INCOME: "Entrata",
  TRANSFER: "Trasferimento",
}

export const RULE_KINDS = [
  "DESCRIPTION_CONTAINS",
  "PROVIDER_CATEGORY_IS",
] as const
export const RuleKindSchema = z.enum(RULE_KINDS, "Scegli un tipo di regola.")
export type RuleKind = z.infer<typeof RuleKindSchema>

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  DESCRIPTION_CONTAINS: "La descrizione contiene",
  PROVIDER_CATEGORY_IS: "La categoria del servizio è",
}
```

Every later task imports `CategoryKind` and `RuleKind` from here. Declaring
them a second time in a service would let the two drift, and the drift would
only show up as a type error months later, in a file that had not changed.

- [ ] **Step 6: Migrate, generate, seed**

Run: `pnpm db:migrate` and answer `finance_meaning` when asked for a name.
Then: `pnpm db:generate && pnpm db:seed`
Expected: the migration applies to the local Postgres on port 5433, and
`Category` holds thirteen rows.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add prisma lib/schemas/finance.ts
git commit -m "feat: a vocabulary, rules that assign it, and links that pair

Categories and rules are household-wide: two people looking at one
movement should see the same word for it. Accounts stay owned, and it
is the movement that carries the privacy.

categorySource is not decoration. It is what lets a rule applied
backwards improve a guess without overruling a decision, which is the
difference between a helpful backfill and losing an afternoon.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Months

**Files:**

- Create: `lib/month.ts`
- Create: `lib/month.test.ts`

**Interfaces:**

- Consumes: `APP_TIMEZONE` from `lib/config.ts`.
- Produces:
  - `monthStartFor(instant: Date): Date`
  - `monthKeyOf(monthStart: Date): string`
  - `monthFromKey(key: string): Date | null`
  - `addMonths(monthStart: Date, delta: number): Date`
  - `monthEndFor(monthStart: Date): Date`

The summary is the only screen with a month, but the month it shows comes from
the address bar and moves backwards, so the arithmetic is worth having in one
tested place — the same reason `lib/week.ts` exists.

- [ ] **Step 1: Write the failing test**

Create `lib/month.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  addMonths,
  monthEndFor,
  monthFromKey,
  monthKeyOf,
  monthStartFor,
} from "@/lib/month"

const iso = (date: Date | null) => date?.toISOString() ?? null

describe("monthStartFor", () => {
  it("is the first of the month the instant falls in", () => {
    expect(iso(monthStartFor(new Date("2026-08-23T09:00:00Z")))).toBe(
      "2026-08-01T00:00:00.000Z"
    )
  })

  it("uses the app's timezone, not the server's", () => {
    // 23:30 UTC on 31 July is already 1 August in Rome, so the month has
    // turned. A server in UTC deciding for itself would say July.
    expect(iso(monthStartFor(new Date("2026-07-31T23:30:00Z")))).toBe(
      "2026-08-01T00:00:00.000Z"
    )
  })
})

describe("monthKeyOf", () => {
  it("writes the month as the address bar carries it", () => {
    expect(monthKeyOf(new Date("2026-08-01T00:00:00Z"))).toBe("2026-08")
  })

  it("pads a single-digit month", () => {
    expect(monthKeyOf(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01")
  })
})

describe("monthFromKey", () => {
  it("reads a key back", () => {
    expect(iso(monthFromKey("2026-08"))).toBe("2026-08-01T00:00:00.000Z")
  })

  it("refuses a month that does not exist", () => {
    expect(monthFromKey("2026-13")).toBeNull()
  })

  it("refuses something that is not a month", () => {
    expect(monthFromKey("boh")).toBeNull()
    expect(monthFromKey("2026-8")).toBeNull()
  })
})

describe("addMonths", () => {
  it("steps backwards", () => {
    expect(iso(addMonths(new Date("2026-08-01T00:00:00Z"), -1))).toBe(
      "2026-07-01T00:00:00.000Z"
    )
  })

  it("crosses a year going back", () => {
    expect(iso(addMonths(new Date("2026-01-01T00:00:00Z"), -1))).toBe(
      "2025-12-01T00:00:00.000Z"
    )
  })

  it("steps forwards", () => {
    expect(iso(addMonths(new Date("2026-12-01T00:00:00Z"), 1))).toBe(
      "2027-01-01T00:00:00.000Z"
    )
  })
})

describe("monthEndFor", () => {
  it("is the last day of the month, so a query can use <=", () => {
    expect(iso(monthEndFor(new Date("2026-02-01T00:00:00Z")))).toBe(
      "2026-02-28T00:00:00.000Z"
    )
  })

  it("knows a leap year", () => {
    expect(iso(monthEndFor(new Date("2028-02-01T00:00:00Z")))).toBe(
      "2028-02-29T00:00:00.000Z"
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/month.test.ts`
Expected: FAIL — cannot resolve `@/lib/month`.

- [ ] **Step 3: Write the implementation**

Create `lib/month.ts`:

```ts
import { APP_TIMEZONE } from "@/lib/config"

const zonedParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
})

const KEY = /^(\d{4})-(\d{2})$/

/**
 * The first day of the month an instant falls in, at midnight UTC.
 *
 * Which month a moment belongs to depends on where the users are, never on
 * where the server is — the same rule as lib/week.ts.
 *
 * @param instant - any moment
 * @returns the first of that month, at midnight UTC
 */
export function monthStartFor(instant: Date): Date {
  const parts = new Map(
    zonedParts.formatToParts(instant).map((part) => [part.type, part.value])
  )

  return new Date(
    Date.UTC(Number(parts.get("year")), Number(parts.get("month")) - 1, 1)
  )
}

/**
 * The month as the address bar carries it.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @returns the key, for example "2026-08"
 */
export function monthKeyOf(monthStart: Date): string {
  const month = String(monthStart.getUTCMonth() + 1).padStart(2, "0")
  return `${monthStart.getUTCFullYear()}-${month}`
}

/**
 * Reads a month key from the address bar.
 *
 * @param key - the search param, as Next delivered it
 * @returns the first of that month at midnight UTC, or null when the key is not
 *   a month
 */
export function monthFromKey(key: string): Date | null {
  const match = KEY.exec(key.trim())
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  return new Date(Date.UTC(year, month - 1, 1))
}

/**
 * Steps a month forwards or backwards.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @param delta - how many months to move; negative goes back
 * @returns the first of the resulting month
 */
export function addMonths(monthStart: Date, delta: number): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + delta, 1)
  )
}

/**
 * The last day of a month, so a date range can be written with `lte`.
 *
 * A `@db.Date` column holds a day, not an instant, so the alternative — "before
 * the first of next month" — would be right too but reads as if it might drop
 * the last day.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @returns its last day, at midnight UTC
 */
export function monthEndFor(monthStart: Date): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/month.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/month.ts lib/month.test.ts
git commit -m "feat: months, in the timezone the household lives in

23:30 UTC on 31 July is already August in Rome. A server deciding for
itself would file that evening's spending under the wrong month, and
the summary would be quietly wrong twice a year.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Which rule matches

**Files:**

- Create: `lib/services/finance/categorise.ts`
- Create: `lib/services/finance/categorise.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type RuleKind = "DESCRIPTION_CONTAINS" | "PROVIDER_CATEGORY_IS"`
  - `type MatchableRule = { id: string; kind: RuleKind; pattern: string; categoryId: string; priority: number; accountId: string | null }`
  - `type MatchableMovement = { accountId: string; description: string; providerCategory: string | null }`
  - `type Match = { categoryId: string; source: "RULE" | "PROVIDER_MAP"; ruleId: string }`
  - `categorise(rules: readonly MatchableRule[], movement: MatchableMovement): Match | null`
  - `suggestPattern(description: string): string`

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/categorise.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  categorise,
  type MatchableRule,
  suggestPattern,
} from "@/lib/services/finance/categorise"

const rule = (over: Partial<MatchableRule> = {}): MatchableRule => ({
  id: "r1",
  kind: "DESCRIPTION_CONTAINS",
  pattern: "esselunga",
  categoryId: "spesa",
  priority: 0,
  accountId: null,
  ...over,
})

const movement = {
  accountId: "acc",
  description: "Pagamento POS — ESSELUNGA SPA, MILANO",
  providerCategory: "Groceries",
}

describe("categorise", () => {
  it("matches a description regardless of case", () => {
    expect(categorise([rule()], movement)).toEqual({
      categoryId: "spesa",
      source: "RULE",
      ruleId: "r1",
    })
  })

  it("matches a pattern written with odd spacing", () => {
    expect(
      categorise([rule({ pattern: "  ESSELUNGA  " })], movement)?.categoryId
    ).toBe("spesa")
  })

  it("prefers a description rule over the provider's own category", () => {
    // The owner wrote the description rule looking at a real case. A specific
    // fact beats a general one, whatever the priorities say.
    const rules = [
      rule({
        id: "map",
        kind: "PROVIDER_CATEGORY_IS",
        pattern: "Groceries",
        categoryId: "altro",
        priority: -100,
      }),
      rule(),
    ]

    expect(categorise(rules, movement)?.categoryId).toBe("spesa")
  })

  it("falls back to the provider's category when no description matches", () => {
    const rules = [
      rule({ pattern: "coop" }),
      rule({
        id: "map",
        kind: "PROVIDER_CATEGORY_IS",
        pattern: "groceries",
        categoryId: "spesa",
      }),
    ]

    expect(categorise(rules, movement)).toEqual({
      categoryId: "spesa",
      source: "PROVIDER_MAP",
      ruleId: "map",
    })
  })

  it("takes the lowest priority first within a kind", () => {
    const rules = [
      rule({ id: "late", pattern: "pagamento", categoryId: "altro", priority: 5 }),
      rule({ id: "early", pattern: "esselunga", categoryId: "spesa", priority: 1 }),
    ]

    expect(categorise(rules, movement)?.ruleId).toBe("early")
  })

  it("ignores a rule scoped to another account", () => {
    expect(categorise([rule({ accountId: "other" })], movement)).toBeNull()
  })

  it("applies a rule scoped to this account", () => {
    expect(categorise([rule({ accountId: "acc" })], movement)?.categoryId).toBe(
      "spesa"
    )
  })

  it("returns null when nothing matches", () => {
    expect(categorise([rule({ pattern: "coop" })], movement)).toBeNull()
  })

  it("returns null for a movement whose provider declared nothing", () => {
    const rules = [rule({ kind: "PROVIDER_CATEGORY_IS", pattern: "groceries" })]
    expect(
      categorise(rules, { ...movement, providerCategory: null })
    ).toBeNull()
  })

  it("matches the provider's category whole, not as a substring", () => {
    // "Bar" must not match "Barber". A description rule is a substring on
    // purpose; a declared category is a value.
    const rules = [rule({ kind: "PROVIDER_CATEGORY_IS", pattern: "Grocer" })]
    expect(categorise(rules, movement)).toBeNull()
  })
})

describe("suggestPattern", () => {
  it("picks the name out of a bank's boilerplate", () => {
    expect(suggestPattern("Pagamento POS — ESSELUNGA SPA, MILANO")).toBe(
      "ESSELUNGA"
    )
  })

  it("keeps a one-word description", () => {
    expect(suggestPattern("Netflix")).toBe("NETFLIX")
  })

  it("skips the words every statement uses", () => {
    expect(suggestPattern("Payment from Thomas")).toBe("THOMAS")
  })

  it("ignores short words, which are never the shop", () => {
    expect(suggestPattern("Bonifico a IL BAR")).toBe("BONIFICO A IL BAR")
  })

  it("gives back the whole description when nothing stands out", () => {
    // Better than an empty field: the owner edits a suggestion, and an empty
    // one suggests the feature is broken.
    expect(suggestPattern("pos carta")).toBe("POS CARTA")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/categorise.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `lib/services/finance/categorise.ts`:

```ts
export type RuleKind = "DESCRIPTION_CONTAINS" | "PROVIDER_CATEGORY_IS"

export type MatchableRule = {
  id: string
  kind: RuleKind
  pattern: string
  categoryId: string
  priority: number
  // Null means every account.
  accountId: string | null
}

export type MatchableMovement = {
  accountId: string
  description: string
  providerCategory: string | null
}

export type Match = {
  categoryId: string
  source: "RULE" | "PROVIDER_MAP"
  ruleId: string
}

const normalise = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim()

// Description rules run as a class before provider-category rules, whatever
// their priorities say: the owner wrote a description rule looking at a real
// movement, and the provider's own word is a generalisation.
const KIND_ORDER: Record<RuleKind, number> = {
  DESCRIPTION_CONTAINS: 0,
  PROVIDER_CATEGORY_IS: 1,
}

/**
 * The category a movement takes from the rules, if any.
 *
 * @param rules - every rule, in any order
 * @param movement - the movement's account, description and declared category
 * @returns the first match, or null when none applies
 */
export function categorise(
  rules: readonly MatchableRule[],
  movement: MatchableMovement
): Match | null {
  const description = normalise(movement.description)
  const declared =
    movement.providerCategory === null
      ? null
      : normalise(movement.providerCategory)

  const applicable = rules
    .filter(
      (rule) => rule.accountId === null || rule.accountId === movement.accountId
    )
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.priority - b.priority
    )

  for (const rule of applicable) {
    const pattern = normalise(rule.pattern)
    if (pattern === "") continue

    if (rule.kind === "DESCRIPTION_CONTAINS") {
      if (description.includes(pattern)) {
        return { categoryId: rule.categoryId, source: "RULE", ruleId: rule.id }
      }
      continue
    }

    // Whole value, not a substring: a declared category is a value the provider
    // chose from a list, and "Bar" matching "Barber" would be a bug nobody
    // would look for.
    if (declared !== null && declared === pattern) {
      return {
        categoryId: rule.categoryId,
        source: "PROVIDER_MAP",
        ruleId: rule.id,
      }
    }
  }

  return null
}

// The words every statement is full of, which are never the thing you would
// write a rule about.
const NOISE = new Set([
  "pagamento",
  "pagamenti",
  "carta",
  "addebito",
  "accredito",
  "bonifico",
  "sepa",
  "commissione",
  "acquisto",
  "prelievo",
  "ricarica",
  "operazione",
  "payment",
  "from",
  "card",
  "transfer",
  "topup",
  "top-up",
])

/**
 * The word a rule about this movement would most likely be written around.
 *
 * A suggestion the owner edits, never a decision: it is prefilled into the
 * rule's field on the movement screen.
 *
 * @param description - the movement's description, as the file wrote it
 * @returns the suggested pattern, uppercased; the whole description when
 *   nothing stands out
 */
export function suggestPattern(description: string): string {
  const words = description
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4)

  const candidate = words.find((word) => !NOISE.has(word.toLowerCase()))

  return (candidate ?? description).trim().toUpperCase()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/categorise.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/finance/categorise.ts lib/services/finance/categorise.test.ts
git commit -m "feat: which rule claims a movement, and which word to suggest

Description rules run as a class before the provider's own category,
whatever the priorities say: the owner wrote one looking at a real
movement, and the provider's word is a generalisation.

A declared category matches whole and not as a substring. It is a value
chosen from a list, and \"Bar\" matching \"Barber\" is a bug nobody
would think to look for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Which pairs are transfers

**Files:**

- Create: `lib/services/finance/pairing.ts`
- Create: `lib/services/finance/pairing.test.ts`
- Modify: `lib/config.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type PairableMovement = { id: string; accountId: string; date: Date; amountCents: number }`
  - `type TransferCandidate = { outgoingId: string; incomingId: string; daysApart: number }`
  - `pairCandidates(rows: readonly PairableMovement[], windowDays: number): { settled: TransferCandidate[]; contested: TransferCandidate[] }`
  - `TRANSFER_WINDOW_DAYS` in `lib/config.ts`

`settled` is a pair whose two movements have no other candidate; `contested` is
everything else, and §7.1 says the service does not choose between those.

- [ ] **Step 1: Add the constant**

In `lib/config.ts`:

```ts
// How far apart the two legs of a transfer may be. Money between two Italian
// accounts lands in one to three days; four leaves room without pairing a
// coincidence a week later.
export const TRANSFER_WINDOW_DAYS = 4
```

- [ ] **Step 2: Write the failing test**

Create `lib/services/finance/pairing.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  pairCandidates,
  type PairableMovement,
} from "@/lib/services/finance/pairing"

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const out = (over: Partial<PairableMovement> = {}): PairableMovement => ({
  id: "out",
  accountId: "intesa",
  date: day("2026-07-10"),
  amountCents: -20000,
  ...over,
})

const inn = (over: Partial<PairableMovement> = {}): PairableMovement => ({
  id: "in",
  accountId: "revolut",
  date: day("2026-07-11"),
  amountCents: 20000,
  ...over,
})

describe("pairCandidates", () => {
  it("pairs equal and opposite amounts on two accounts", () => {
    const { settled, contested } = pairCandidates([out(), inn()], 4)

    expect(settled).toEqual([
      { outgoingId: "out", incomingId: "in", daysApart: 1 },
    ])
    expect(contested).toEqual([])
  })

  it("pairs two legs on the same day", () => {
    const { settled } = pairCandidates(
      [out(), inn({ date: day("2026-07-10") })],
      4
    )
    expect(settled[0]?.daysApart).toBe(0)
  })

  it("does not pair two movements on the same account", () => {
    const { settled, contested } = pairCandidates(
      [out(), inn({ accountId: "intesa" })],
      4
    )
    expect(settled).toEqual([])
    expect(contested).toEqual([])
  })

  it("does not pair amounts that differ", () => {
    expect(pairCandidates([out(), inn({ amountCents: 19900 })], 4).settled)
      .toEqual([])
  })

  it("does not pair two outgoings", () => {
    expect(
      pairCandidates([out(), out({ id: "b", accountId: "revolut" })], 4).settled
    ).toEqual([])
  })

  it("pairs at the edge of the window", () => {
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-14") })], 4).settled
    ).toHaveLength(1)
  })

  it("does not pair beyond the window", () => {
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-15") })], 4).settled
    ).toEqual([])
  })

  it("pairs an incoming that came first", () => {
    // The leg that lands first is not always the one that left first.
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-08") })], 4).settled
    ).toHaveLength(1)
  })

  it("contests a pair when one leg has two candidates", () => {
    // Two identical top-ups in the same week. Choosing one would be guessing,
    // and a wrong guess hides a real expense.
    const { settled, contested } = pairCandidates(
      [out(), inn(), inn({ id: "in2", date: day("2026-07-12") })],
      4
    )

    expect(settled).toEqual([])
    expect(contested).toHaveLength(2)
  })

  it("keeps an unrelated settled pair out of a contest", () => {
    const rows = [
      out(),
      inn(),
      inn({ id: "in2", date: day("2026-07-12") }),
      out({ id: "out3", amountCents: -5000, date: day("2026-07-20") }),
      inn({ id: "in3", amountCents: 5000, date: day("2026-07-20") }),
    ]

    const { settled, contested } = pairCandidates(rows, 4)

    expect(settled).toEqual([
      { outgoingId: "out3", incomingId: "in3", daysApart: 0 },
    ])
    expect(contested).toHaveLength(2)
  })

  it("ignores a movement of zero, which pairs with itself on paper", () => {
    const rows = [
      out({ id: "z1", amountCents: 0 }),
      inn({ id: "z2", amountCents: 0 }),
    ]
    expect(pairCandidates(rows, 4).settled).toEqual([])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/pairing.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 4: Write the implementation**

Create `lib/services/finance/pairing.ts`:

```ts
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
  // Zero never pairs: two of them match every rule below and mean nothing.
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/pairing.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/services/finance/pairing.ts lib/services/finance/pairing.test.ts lib/config.ts
git commit -m "feat: the pairs that look like a transfer, and the ones nobody can call

A movement wanted by two candidates makes both contested, and so does
its partner. Picking one would be guessing, and a wrong guess hides a
real expense until the month is long over.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: What a month adds up to

**Files:**

- Create: `lib/services/finance/summary.ts`
- Create: `lib/services/finance/summary.test.ts`

**Interfaces:**

- Consumes: `CategoryKind` from `lib/schemas/finance.ts` (Task 1).
- Produces:
  - `type CountableRow = { amountCents: number; categoryId: string | null; categoryKind: CategoryKind | null }`
  - `countsTowardsTotals(kind: CategoryKind | null): boolean`
  - `totalsOf(rows: readonly CountableRow[]): { incomeCents: number; outgoingsCents: number; uncategorisedCount: number }`
  - `outgoingsByCategory(rows: readonly CountableRow[]): { categoryId: string | null; cents: number }[]`
  - `meanOf(values: readonly (number | null)[]): number | null`

`countsTowardsTotals` is the single place the `TRANSFER` exclusion of §8.2 is
written. Every screen showing a total goes through it.

- [ ] **Step 1: Write the failing test**

Create `lib/services/finance/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  type CountableRow,
  countsTowardsTotals,
  meanOf,
  outgoingsByCategory,
  totalsOf,
} from "@/lib/services/finance/summary"

const row = (over: Partial<CountableRow> = {}): CountableRow => ({
  amountCents: -1000,
  categoryId: "spesa",
  categoryKind: "EXPENSE",
  ...over,
})

describe("countsTowardsTotals", () => {
  it("counts an expense", () => {
    expect(countsTowardsTotals("EXPENSE")).toBe(true)
  })

  it("counts income", () => {
    expect(countsTowardsTotals("INCOME")).toBe(true)
  })

  it("does not count a transfer", () => {
    expect(countsTowardsTotals("TRANSFER")).toBe(false)
  })

  it("counts a movement with no category at all", () => {
    // It is real money. Dropping it would make the totals quietly small, which
    // is the module's one unacceptable failure wearing a different hat.
    expect(countsTowardsTotals(null)).toBe(true)
  })
})

describe("totalsOf", () => {
  it("splits outgoings from income", () => {
    expect(
      totalsOf([
        row({ amountCents: -4230 }),
        row({ amountCents: 185000, categoryKind: "INCOME" }),
      ])
    ).toEqual({
      incomeCents: 185000,
      outgoingsCents: -4230,
      uncategorisedCount: 0,
    })
  })

  it("leaves both legs of a transfer out of both", () => {
    expect(
      totalsOf([
        row({ amountCents: -20000, categoryKind: "TRANSFER" }),
        row({ amountCents: 20000, categoryKind: "TRANSFER" }),
      ])
    ).toEqual({ incomeCents: 0, outgoingsCents: 0, uncategorisedCount: 0 })
  })

  it("counts an uncategorised movement, and says how many there are", () => {
    expect(
      totalsOf([row({ categoryId: null, categoryKind: null })])
    ).toEqual({
      incomeCents: 0,
      outgoingsCents: -1000,
      uncategorisedCount: 1,
    })
  })

  it("is zero for a month with nothing in it", () => {
    expect(totalsOf([])).toEqual({
      incomeCents: 0,
      outgoingsCents: 0,
      uncategorisedCount: 0,
    })
  })
})

describe("outgoingsByCategory", () => {
  it("adds up each category and puts the biggest first", () => {
    expect(
      outgoingsByCategory([
        row({ amountCents: -1000 }),
        row({ amountCents: -2000, categoryId: "bar" }),
        row({ amountCents: -500 }),
      ])
    ).toEqual([
      { categoryId: "bar", cents: -2000 },
      { categoryId: "spesa", cents: -1500 },
    ])
  })

  it("keeps the uncategorised together under null", () => {
    expect(
      outgoingsByCategory([row({ categoryId: null, categoryKind: null })])
    ).toEqual([{ categoryId: null, cents: -1000 }])
  })

  it("leaves out income and transfers", () => {
    expect(
      outgoingsByCategory([
        row({ amountCents: 185000, categoryKind: "INCOME" }),
        row({ amountCents: -20000, categoryKind: "TRANSFER" }),
      ])
    ).toEqual([])
  })
})

describe("meanOf", () => {
  it("averages the months that have data", () => {
    expect(meanOf([-10000, -20000, -30000])).toBe(-20000)
  })

  it("ignores a month with no data at all", () => {
    // Not the same as a month where nothing was spent on this category: that
    // one is a zero and pulls the mean down, which is correct.
    expect(meanOf([-10000, null, -30000])).toBe(-20000)
  })

  it("counts a month with a real zero", () => {
    expect(meanOf([-10000, 0, -20000])).toBe(-10000)
  })

  it("returns null when no month has data", () => {
    expect(meanOf([null, null])).toBeNull()
  })

  it("rounds to whole cents", () => {
    expect(meanOf([-10000, -10001])).toBe(-10001)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/finance/summary.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the implementation**

Create `lib/services/finance/summary.ts`:

```ts
import type { CategoryKind } from "@/lib/schemas/finance"

export type CountableRow = {
  amountCents: number
  categoryId: string | null
  categoryKind: CategoryKind | null
}

/**
 * Whether a movement belongs in income and outgoings.
 *
 * The one place the transfer exclusion of the design document section 8.2 is
 * written. A transfer is neither: the money moved between two pockets that are
 * both yours. It still counts towards a balance — that is a different question
 * and a different function.
 *
 * A movement with no category counts. It is real money, and dropping it would
 * make every total quietly small.
 *
 * @param kind - the movement's category kind, or null when it has none
 * @returns true when it belongs in the totals
 */
export function countsTowardsTotals(kind: CategoryKind | null): boolean {
  return kind !== "TRANSFER"
}

/**
 * What a set of movements came to.
 *
 * @param rows - the movements of one month, over the visible accounts
 * @returns income and outgoings in cents — outgoings negative, as stored — and
 *   how many rows still have no category
 */
export function totalsOf(rows: readonly CountableRow[]): {
  incomeCents: number
  outgoingsCents: number
  uncategorisedCount: number
} {
  let incomeCents = 0
  let outgoingsCents = 0
  let uncategorisedCount = 0

  for (const row of rows) {
    if (row.categoryId === null) uncategorisedCount++
    if (!countsTowardsTotals(row.categoryKind)) continue

    if (row.amountCents >= 0) incomeCents += row.amountCents
    else outgoingsCents += row.amountCents
  }

  return { incomeCents, outgoingsCents, uncategorisedCount }
}

/**
 * The month's spending, split by category, biggest first.
 *
 * @param rows - the movements of one month, over the visible accounts
 * @returns one entry per category that was spent on; null groups the ones with
 *   no category yet
 */
export function outgoingsByCategory(
  rows: readonly CountableRow[]
): { categoryId: string | null; cents: number }[] {
  const totals = new Map<string | null, number>()

  for (const row of rows) {
    if (!countsTowardsTotals(row.categoryKind)) continue
    if (row.amountCents >= 0) continue

    totals.set(
      row.categoryId,
      (totals.get(row.categoryId) ?? 0) + row.amountCents
    )
  }

  return [...totals.entries()]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => a.cents - b.cents)
}

/**
 * The average of the months that have anything to say.
 *
 * A null is a month with no movements at all — before the first import, say —
 * and averaging it as a zero would drag every comparison down and make this
 * month look worse than it is. A month that really spent nothing on a category
 * is a zero and does count.
 *
 * @param values - one entry per month, null when the month holds no data
 * @returns the mean in whole cents, or null when no month has data
 */
export function meanOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((value) => value !== null)
  if (known.length === 0) return null

  const total = known.reduce((sum, value) => sum + value, 0)
  return Math.round(total / known.length)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/finance/summary.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/finance/summary.ts lib/services/finance/summary.test.ts
git commit -m "feat: what a month came to, and what a month usually comes to

countsTowardsTotals is the only place the transfer exclusion is
written, and it says yes to a movement with no category — that is real
money, and dropping it would make every total quietly small.

A month with no data at all is not a zero. Averaging it as one drags
the comparison down and makes this month look worse than it is.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Categories and rules, read and written

**Files:**

- Modify: `lib/schemas/finance.ts`
- Modify: `lib/schemas/finance.test.ts`
- Create: `lib/services/finance/categories.ts`
- Create: `lib/services/finance/rules.ts`

**Interfaces:**

- Consumes: `visibleTo` (core plan), `categorise`, `MatchableRule` (Task 3).
- Produces:
  - `CategoryIdSchema`, `RuleIdSchema`, `CategoryInputSchema`, `type CategoryInput`, `RuleInputSchema`, `type RuleInput`
  - `listCategories(): Promise<CategorySummary[]>`, `createCategory`, `updateCategory`
  - `type CategorySummary = { id: string; name: string; kind: CategoryKind; archived: boolean; usedIn: number }`
  - `transferCategoryId(): Promise<string>`
  - `listRules(): Promise<RuleSummary[]>`, `createRule`, `deleteRule`, `moveRule`
  - `matchableRules(): Promise<MatchableRule[]>`

- [ ] **Step 1: Extend the schemas**

The kind enums and their labels went in with Task 1. This appends the ids and
the two form schemas to `lib/schemas/finance.ts`:

```ts
export const CategoryIdSchema = z.cuid("Questa categoria non è valida.")
export const RuleIdSchema = z.cuid("Questa regola non è valida.")

export const CategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dai un nome alla categoria.")
    .max(40, "Il nome può avere al massimo 40 caratteri."),
  kind: CategoryKindSchema,
  archived: z.boolean(),
})

export type CategoryInput = z.infer<typeof CategoryInputSchema>

export const RuleInputSchema = z.object({
  kind: RuleKindSchema,
  pattern: z
    .string()
    .trim()
    .min(2, "Scrivi almeno due caratteri.")
    .max(80, "Il testo può avere al massimo 80 caratteri."),
  categoryId: CategoryIdSchema,
  // Empty means every account, which is what the picker's first option posts.
  accountId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || FinanceAccountIdSchema.safeParse(value).success,
      "Questo conto non è valido."
    ),
})

export type RuleInput = z.infer<typeof RuleInputSchema>
```

- [ ] **Step 2: Write the failing schema test**

Append to `lib/schemas/finance.test.ts`, and add `RuleInputSchema` to its
imports:

```ts
describe("RuleInputSchema", () => {
  const valid = {
    kind: "DESCRIPTION_CONTAINS",
    pattern: "ESSELUNGA",
    categoryId: "cmt5jj0d8000bw0pfc1kl0yqd",
    accountId: "",
  }

  it("reads an empty account as every account", () => {
    expect(RuleInputSchema.parse(valid).accountId).toBeNull()
  })

  it("keeps an account when one is chosen", () => {
    expect(
      RuleInputSchema.parse({
        ...valid,
        accountId: "cmt5jhdxs0000w0pfpuhad789",
      }).accountId
    ).toBe("cmt5jhdxs0000w0pfpuhad789")
  })

  it("refuses a one-character pattern, which would match everything", () => {
    expect(RuleInputSchema.safeParse({ ...valid, pattern: "a" }).success).toBe(
      false
    )
  })

  it("refuses an account id that is not an id", () => {
    expect(
      RuleInputSchema.safeParse({ ...valid, accountId: "boh" }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm exec vitest run lib/schemas/finance.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 4: Write the categories service**

Create `lib/services/finance/categories.ts`:

```ts
import { db } from "@/lib/db"
import type { CategoryInput, CategoryKind } from "@/lib/schemas/finance"

export type CategorySummary = {
  id: string
  name: string
  kind: CategoryKind
  archived: boolean
  usedIn: number
}

/** Thrown when a category is created with a name that is already taken. */
export class CategoryExistsError extends Error {
  constructor() {
    super("A category with that name already exists.")
    this.name = "CategoryExistsError"
  }
}

/** Thrown when nothing in the database carries the TRANSFER kind. */
export class NoTransferCategoryError extends Error {
  constructor() {
    super("No category has kind TRANSFER. Run the seed.")
    this.name = "NoTransferCategoryError"
  }
}

/**
 * Every category, in the order a picker should offer them.
 *
 * Household-wide, so it takes no actor: a category is a shared word, not a
 * private one. The count of movements is what makes archiving a considered act
 * rather than a guess.
 *
 * @returns the categories, archived ones last
 */
export async function listCategories(): Promise<CategorySummary[]> {
  const rows = await db.category.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      archived: true,
      _count: { select: { movements: true } },
    },
    orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    archived: row.archived,
    usedIn: row._count.movements,
  }))
}

/**
 * The id of the one category confirming a transfer assigns.
 *
 * @returns its id
 * @throws NoTransferCategoryError when the seed has never run
 */
export async function transferCategoryId(): Promise<string> {
  const row = await db.category.findFirst({
    where: { kind: "TRANSFER" },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  })

  if (row === null) throw new NoTransferCategoryError()
  return row.id
}

/**
 * Adds a category to the vocabulary.
 *
 * @param input - the validated form
 * @returns the new category's id
 * @throws CategoryExistsError when the name is taken
 */
export async function createCategory(input: CategoryInput): Promise<string> {
  const existing = await db.category.findUnique({
    where: { name: input.name },
    select: { id: true },
  })
  if (existing !== null) throw new CategoryExistsError()

  const last = await db.category.findFirst({
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  })

  const created = await db.category.create({
    data: { ...input, sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: { id: true },
  })

  return created.id
}

/**
 * Renames a category, changes its kind, or takes it out of the pickers.
 *
 * Archiving rather than deleting: a deleted category would either orphan the
 * movements that carry it or recategorise them, and both rewrite the past.
 *
 * @param id - the category's id
 * @param input - the validated form
 * @returns nothing
 * @throws CategoryExistsError when the new name belongs to another category
 */
export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<void> {
  const clash = await db.category.findFirst({
    where: { name: input.name, id: { not: id } },
    select: { id: true },
  })
  if (clash !== null) throw new CategoryExistsError()

  await db.category.update({ where: { id }, data: input })
}
```

- [ ] **Step 5: Write the rules service**

Create `lib/services/finance/rules.ts`:

```ts
import { db } from "@/lib/db"
import type { RuleInput } from "@/lib/schemas/finance"
import type { MatchableRule } from "@/lib/services/finance/categorise"

export type RuleSummary = {
  id: string
  kind: MatchableRule["kind"]
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
  const swapWith = direction === "up" ? at - 1 : at + 1
  const a = rules[at]
  const b = rules[swapWith]

  if (a === undefined || b === undefined) return

  await db.$transaction([
    db.categoryRule.update({ where: { id: a.id }, data: { priority: b.priority } }),
    db.categoryRule.update({ where: { id: b.id }, data: { priority: a.priority } }),
  ])
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm verify`

```bash
git add lib/schemas/finance.ts lib/schemas/finance.test.ts lib/services/finance/categories.ts lib/services/finance/rules.ts
git commit -m "feat: the vocabulary and the rules that assign it

A new rule sorts ahead of every older one. The owner writes one while
looking at a movement the existing rules got wrong, so putting it last
would leave the rule that already claimed it still winning.

Reordering swaps two priorities rather than renumbering the list, so
two people reordering at once cannot collapse it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Applying the rules

**Files:**

- Create: `lib/services/finance/apply-rules.ts`
- Modify: `lib/services/finance/import.ts`

**Interfaces:**

- Consumes: `categorise`, `matchableRules`, `visibleTo`.
- Produces:
  - `applyRulesTo(movementIds: readonly string[]): Promise<number>`
  - `applyRulesToPast(actorId: string): Promise<number>`
  - `countUncategorised(actorId: string): Promise<number>`

- [ ] **Step 1: Write the service**

Create `lib/services/finance/apply-rules.ts`:

```ts
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

// One movement, one update. A CASE expression over the whole set would be one
// round trip instead of a few hundred, and this runs after an import or on a
// tap — neither is a hot path, and the loop is the version anyone can read.
async function assign(
  rows: readonly {
    id: string
    accountId: string
    description: string
    providerCategory: string | null
  }[]
): Promise<number> {
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
```

- [ ] **Step 2: Have the import run them**

In `lib/services/finance/import.ts`, extend `ImportOutcome`:

```ts
export type ImportOutcome = ImportPreview & {
  batchId: string
  categorisedCount: number
}
```

`createMany` does not return rows, so the transaction reads back what it wrote —
by the batch, which is the only thing that owns exactly those rows. Its last
lines become:

```ts
    if (prepared.toWrite.length > 0) {
      await tx.movement.createMany({ /* unchanged */ })
    }

    const written = await tx.movement.findMany({
      where: { importBatchId: batch.id },
      select: { id: true },
    })

    return { batchId: batch.id, writtenIds: written.map((row) => row.id) }
  })
```

and the line that receives it changes from

```ts
  const batchId = await db.$transaction(async (tx) => {
```

to

```ts
  const { batchId, writtenIds } = await db.$transaction(async (tx) => {
```

Then, after the transaction:

```ts
  // Outside the transaction on purpose: the movements are already safe, and a
  // rule that throws must not take the import down with it. The worst case is
  // an import whose rows arrived uncategorised, which the owner fixes with one
  // tap on the rules screen.
  const categorisedCount = await applyRulesTo(writtenIds)
```

and the return becomes `{ ...report(prepared), batchId, categorisedCount }`.
Add the import of `applyRulesTo` at the top of the file.

- [ ] **Step 3: Verify and commit**

Run: `pnpm verify`

```bash
git add lib/services/finance/apply-rules.ts lib/services/finance/import.ts
git commit -m "feat: the rules run on arrival, and backwards when asked

Backwards touches only what nobody decided by hand. A rule may improve
a guess and may not overrule a decision — without that line, the first
\"apply to the past too\" costs an afternoon of corrections and nobody
notices until the summary is wrong.

They never run by themselves. A history that changed under someone who
changed nothing is worse than one that is out of date.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Confirming a transfer

**Files:**

- Create: `lib/services/finance/transfers.ts`

**Interfaces:**

- Consumes: `pairCandidates`, `TRANSFER_WINDOW_DAYS`, `transferCategoryId`,
  `visibleTo`, `matchableRules`, `categorise`.
- Produces:
  - `type CandidatePair = { outgoing: CandidateLeg; incoming: CandidateLeg; daysApart: number; contested: boolean }`
  - `type CandidateLeg = { id: string; date: Date; amountCents: number; description: string; accountName: string }`
  - `listTransferCandidates(actorId: string): Promise<CandidatePair[]>`
  - `countTransferCandidates(actorId: string): Promise<number>`
  - `confirmTransfer(actorId: string, outgoingId: string, incomingId: string): Promise<void>`
  - `unlinkTransfer(actorId: string, movementId: string): Promise<void>`
  - `class TransferNotPairableError extends Error`

- [ ] **Step 1: Write the service**

Create `lib/services/finance/transfers.ts`:

```ts
import { TRANSFER_WINDOW_DAYS } from "@/lib/config"
import { db } from "@/lib/db"
import { visibleTo } from "@/lib/services/finance/access"
import { categorise } from "@/lib/services/finance/categorise"
import { transferCategoryId } from "@/lib/services/finance/categories"
import { pairCandidates } from "@/lib/services/finance/pairing"
import { matchableRules } from "@/lib/services/finance/rules"

export type CandidateLeg = {
  id: string
  date: Date
  amountCents: number
  description: string
  accountName: string
}

export type CandidatePair = {
  outgoing: CandidateLeg
  incoming: CandidateLeg
  daysApart: number
  // True when one of the two legs has another candidate. The screen shows
  // these together and does not offer a bulk confirm for them.
  contested: boolean
}

/** Thrown when two movements are asked to be a pair and cannot be one. */
export class TransferNotPairableError extends Error {
  constructor() {
    super("Those two movements cannot be a transfer.")
    this.name = "TransferNotPairableError"
  }
}

const LEG = {
  id: true,
  accountId: true,
  date: true,
  amountCents: true,
  description: true,
  account: { select: { name: true } },
} as const

async function unlinkedMovements(actorId: string) {
  return db.movement.findMany({
    where: {
      account: visibleTo(actorId),
      transferFrom: null,
      transferTo: null,
    },
    select: LEG,
  })
}

/**
 * The pairs that look like one movement of money between two accounts.
 *
 * Runs over every unlinked movement, not only the ones just imported: Revolut
 * is exported today and Intesa next week, and the pair forms next week.
 *
 * @param actorId - the user id, from the session
 * @returns the candidates, settled ones first, newest first within each group
 */
export async function listTransferCandidates(
  actorId: string
): Promise<CandidatePair[]> {
  const rows = await unlinkedMovements(actorId)
  const byId = new Map(rows.map((row) => [row.id, row]))

  const leg = (id: string): CandidateLeg => {
    const row = byId.get(id)
    if (row === undefined) throw new TransferNotPairableError()
    return {
      id: row.id,
      date: row.date,
      amountCents: row.amountCents,
      description: row.description,
      accountName: row.account.name,
    }
  }

  const { settled, contested } = pairCandidates(rows, TRANSFER_WINDOW_DAYS)

  const pairs = [
    ...settled.map((pair) => ({ ...pair, contested: false })),
    ...contested.map((pair) => ({ ...pair, contested: true })),
  ]

  return pairs
    .map((pair) => ({
      outgoing: leg(pair.outgoingId),
      incoming: leg(pair.incomingId),
      daysApart: pair.daysApart,
      contested: pair.contested,
    }))
    .sort((a, b) => {
      if (a.contested !== b.contested) return a.contested ? 1 : -1
      return b.outgoing.date.getTime() - a.outgoing.date.getTime()
    })
}

/**
 * How many pairs are waiting to be confirmed.
 *
 * The number the summary shows, and the reason the totals under it are not yet
 * true: an unconfirmed transfer counts as both income and an outgoing.
 *
 * @param actorId - the user id, from the session
 * @returns the count
 */
export async function countTransferCandidates(
  actorId: string
): Promise<number> {
  const rows = await unlinkedMovements(actorId)
  const { settled, contested } = pairCandidates(rows, TRANSFER_WINDOW_DAYS)
  return settled.length + contested.length
}

/**
 * Links two movements as the two legs of one transfer.
 *
 * Both take the TRANSFER category, so the summary has one rule to obey and not
 * two. Re-checks the pairing conditions rather than trusting the caller: this
 * runs from a server action, which anyone signed in can call directly.
 *
 * @param actorId - the user id, from the session
 * @param outgoingId - the leg that left
 * @param incomingId - the leg that arrived
 * @returns nothing
 * @throws TransferNotPairableError when the two are not a possible pair, or one
 *   of them is already linked, or either is on an account the user cannot see
 */
export async function confirmTransfer(
  actorId: string,
  outgoingId: string,
  incomingId: string
): Promise<void> {
  const rows = await db.movement.findMany({
    where: {
      id: { in: [outgoingId, incomingId] },
      account: visibleTo(actorId),
      transferFrom: null,
      transferTo: null,
    },
    select: { id: true, accountId: true, date: true, amountCents: true },
  })

  const outgoing = rows.find((row) => row.id === outgoingId)
  const incoming = rows.find((row) => row.id === incomingId)
  if (outgoing === undefined || incoming === undefined) {
    throw new TransferNotPairableError()
  }

  const { settled, contested } = pairCandidates(
    [outgoing, incoming],
    TRANSFER_WINDOW_DAYS
  )
  const allowed = [...settled, ...contested].some(
    (pair) => pair.outgoingId === outgoingId && pair.incomingId === incomingId
  )
  if (!allowed) throw new TransferNotPairableError()

  const categoryId = await transferCategoryId()

  await db.$transaction([
    db.transferLink.create({
      data: { fromMovementId: outgoingId, toMovementId: incomingId },
    }),
    db.movement.updateMany({
      where: { id: { in: [outgoingId, incomingId] } },
      data: { categoryId, categorySource: "TRANSFER_LINK" },
    }),
  ])
}

/**
 * Breaks a link, and lets the rules have another go at both legs.
 *
 * Re-running the rules rather than clearing the category outright: it leaves
 * each leg either recategorised or back under «Da categorizzare», and never
 * leaves «Trasferimento» on a movement that is no longer one.
 *
 * @param actorId - the user id, from the session
 * @param movementId - either leg
 * @returns nothing
 */
export async function unlinkTransfer(
  actorId: string,
  movementId: string
): Promise<void> {
  // The visibility is checked on the movement the caller named, not on one of
  // the two legs by position: a link spans two accounts, and the two need not
  // be visible to the same person. Checking `fromMovement` would refuse a
  // legitimate unlink from the other side, and pass one it should refuse.
  const named = await db.movement.findFirst({
    where: { id: movementId, account: visibleTo(actorId) },
    select: { id: true },
  })
  if (named === null) return

  const link = await db.transferLink.findFirst({
    where: {
      OR: [{ fromMovementId: movementId }, { toMovementId: movementId }],
    },
    select: { id: true, fromMovementId: true, toMovementId: true },
  })

  if (link === null) return

  const ids = [link.fromMovementId, link.toMovementId]

  await db.$transaction([
    db.transferLink.delete({ where: { id: link.id } }),
    db.movement.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: null, categorySource: "NONE" },
    }),
  ])

  const rules = await matchableRules()
  const rows = await db.movement.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      accountId: true,
      description: true,
      providerCategory: true,
    },
  })

  for (const row of rows) {
    const match = categorise(rules, row)
    if (match === null) continue
    await db.movement.update({
      where: { id: row.id },
      data: { categoryId: match.categoryId, categorySource: match.source },
    })
  }
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm verify`

```bash
git add lib/services/finance/transfers.ts
git commit -m "feat: a pair becomes a transfer only when somebody says so

confirmTransfer re-checks the pairing conditions instead of trusting
what it was handed. It runs from a server action, which is a public
endpoint, and a forged pair would hide a real expense in the one
category the totals ignore.

Unlinking re-runs the rules over both legs rather than clearing them,
so neither is left saying \"Trasferimento\" when it is no longer one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The month, read

**Files:**

- Create: `lib/services/finance/month-summary.ts`

**Interfaces:**

- Consumes: `totalsOf`, `outgoingsByCategory`, `meanOf` (Task 5),
  `monthStartFor`, `monthEndFor`, `addMonths` (Task 2), `visibleTo`.
- Produces:
  - `type MonthSummary = { monthStart: Date; incomeCents: number; outgoingsCents: number; uncategorisedCount: number; categories: MonthCategory[] }`
  - `type MonthCategory = { categoryId: string | null; name: string; cents: number; meanCents: number | null }`
  - `monthSummary(actorId: string, monthStart: Date): Promise<MonthSummary>`

- [ ] **Step 1: Write the service**

Create `lib/services/finance/month-summary.ts`:

```ts
import { db } from "@/lib/db"
import { addMonths, monthEndFor } from "@/lib/month"
import { visibleTo } from "@/lib/services/finance/access"
import {
  meanOf,
  outgoingsByCategory,
  totalsOf,
} from "@/lib/services/finance/summary"

// Three months of history behind the one on screen — the comparison of the
// design document section 8.3.
const COMPARISON_MONTHS = 3

export type MonthCategory = {
  categoryId: string | null
  name: string
  cents: number
  // Null when no earlier month holds any data at all: there is nothing to
  // compare against yet, and a mean of nothing would read as "you usually spend
  // zero".
  meanCents: number | null
}

export type MonthSummary = {
  monthStart: Date
  incomeCents: number
  outgoingsCents: number
  uncategorisedCount: number
  categories: MonthCategory[]
}

const UNCATEGORISED = "Da categorizzare"

async function rowsIn(actorId: string, monthStart: Date) {
  return db.movement.findMany({
    where: {
      account: visibleTo(actorId),
      date: { gte: monthStart, lte: monthEndFor(monthStart) },
    },
    select: {
      amountCents: true,
      categoryId: true,
      category: { select: { name: true, kind: true } },
    },
  })
}

/**
 * What a month came to, and how each category compares with the three before.
 *
 * @param actorId - the user id, from the session
 * @param monthStart - the first of the month, at midnight UTC
 * @returns income, outgoings, how much is still uncategorised, and the split of
 *   spending by category with its mean
 */
export async function monthSummary(
  actorId: string,
  monthStart: Date
): Promise<MonthSummary> {
  const current = await rowsIn(actorId, monthStart)

  const countable = current.map((row) => ({
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    categoryKind: row.category?.kind ?? null,
  }))

  const names = new Map(
    current.flatMap((row) =>
      row.categoryId === null || row.category === null
        ? []
        : [[row.categoryId, row.category.name] as const]
    )
  )

  const earlier = await Promise.all(
    Array.from({ length: COMPARISON_MONTHS }, (_, index) =>
      rowsIn(actorId, addMonths(monthStart, -(index + 1)))
    )
  )

  // A month with no movements at all contributes null rather than zero: it is
  // "we have no data", not "we spent nothing", and averaging it as zero would
  // make every comparison flatter this month.
  const historyFor = (categoryId: string | null) =>
    earlier.map((month) => {
      if (month.length === 0) return null

      const split = outgoingsByCategory(
        month.map((row) => ({
          amountCents: row.amountCents,
          categoryId: row.categoryId,
          categoryKind: row.category?.kind ?? null,
        }))
      )

      return split.find((entry) => entry.categoryId === categoryId)?.cents ?? 0
    })

  const totals = totalsOf(countable)

  return {
    monthStart,
    incomeCents: totals.incomeCents,
    outgoingsCents: totals.outgoingsCents,
    uncategorisedCount: totals.uncategorisedCount,
    categories: outgoingsByCategory(countable).map((entry) => ({
      categoryId: entry.categoryId,
      name:
        entry.categoryId === null
          ? UNCATEGORISED
          : (names.get(entry.categoryId) ?? UNCATEGORISED),
      cents: entry.cents,
      meanCents: meanOf(historyFor(entry.categoryId)),
    })),
  }
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm verify`

```bash
git add lib/services/finance/month-summary.ts
git commit -m "feat: the month, against the three before it

A month with no movements at all contributes null and not zero. It
means \"we have no data\", not \"we spent nothing\", and averaging it
as zero would flatter every month that follows the first import.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The chips learn to scroll, and the list gains its filter

**Files:**

- Modify: `components/page/filter-chips.tsx`
- Modify: `app/(app)/finance/movements/page.tsx`
- Modify: `lib/services/finance/movements.ts`

**Interfaces:**

- Consumes: `listCategories` (Task 6).
- Produces: `MovementFilters` gains `category?: string`, and `MovementRow`
  gains `categoryName: string | null`.

- [ ] **Step 1: Make the chip row scroll**

In `components/page/filter-chips.tsx`, the `<ul className="flex gap-2">`
becomes:

```tsx
      {/* Scrolls rather than wraps. With four chips it makes no difference;
          with fourteen categories a wrapping row is three lines of chips above
          every list, and an overflowing one hides the last of them off a 390px
          screen with no way to reach it. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
```

The negative margin and matching padding let the row bleed to the screen edge,
so a chip cut off at the right reads as "there is more" rather than as a
mistake.

- [ ] **Step 2: Teach the service the filter**

In `lib/services/finance/movements.ts`, extend the type and the query:

```ts
export type MovementFilters = {
  accountId?: string
  q?: string
  // "uncategorised" for the ones with no category, otherwise a category id.
  category?: string
}
```

```ts
export const UNCATEGORISED_FILTER = "uncategorised"
```

In `listMovements`, beside the existing `description` condition:

```ts
      ...(filters.category === undefined
        ? {}
        : filters.category === UNCATEGORISED_FILTER
          ? { categoryId: null }
          : { categoryId: filters.category }),
```

and add the category to the selection and the returned row:

```ts
      category: { select: { name: true } },
```

```ts
      categoryName: row.category?.name ?? null,
```

with `categoryName: string | null` added to `MovementRow`.

- [ ] **Step 3: Put the filter on the page**

In `app/(app)/finance/movements/page.tsx`:

- read `category` from `searchParams` with `firstOf`;
- fetch `listCategories()` alongside the accounts and the page;
- build the chips: `Tutti`, `Da categorizzare` (value
  `UNCATEGORISED_FILTER`), then every category that is not archived — the
  `TRANSFER` one included, which is how «Trasferimenti» appears without being a
  filter of its own;
- render a second `FilterChips` with `param="category"`, `keep={{ q, account }}`,
  and add `category` to the account chips' `keep`;
- show `movement.categoryName ?? "da categorizzare"` in the row's muted line,
  after the account;
- carry `category` in the «Mostra altri» address.

- [ ] **Step 4: Verify and commit**

Run: `pnpm verify`

```bash
git add components/page/filter-chips.tsx app/\(app\)/finance/movements lib/services/finance/movements.ts
git commit -m "feat: filter by category, and a chip row that scrolls

Fourteen categories wrap to three lines above every list, or overflow
with the last of them unreachable off a 390px screen. The row scrolls
and bleeds to the edge, so a chip cut off reads as \"there is more\".

Uncategorised and transfers are values of this one filter and not
filters of their own — a transfer is a category like any other, and
what makes it special lives in one function in summary.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: The movement decides its category

**Files:**

- Create: `components/finance/movement-category-form.tsx`
- Modify: `app/(app)/finance/movements/[id]/page.tsx`
- Modify: `app/(app)/finance/movements/[id]/actions.ts`
- Modify: `lib/services/finance/movements.ts`

**Interfaces:**

- Consumes: `listCategories`, `createRule`, `applyRulesToPast`,
  `suggestPattern`, `unlinkTransfer`, `setMovementCategory`.
- Produces:
  - `setMovementCategory(actorId: string, id: string, categoryId: string): Promise<boolean>` in `movements.ts`
  - `MovementDetail` gains `categoryId: string | null`, `categoryName: string | null`, `twin: { id: string; description: string; accountName: string } | null`
  - `saveMovementCategory: FormAction` and `unlinkMovementTransfer(id: string)` in the actions file

This is the one-tap rule of §6.2, asked as one form rather than three
questions.

- [ ] **Step 1: Add the write and the read**

In `lib/services/finance/movements.ts`:

```ts
/**
 * Sets a movement's category by hand.
 *
 * `MANUAL` is what protects it: a rule applied backwards skips it afterwards,
 * because a rule may improve a guess and may not overrule a decision.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @param categoryId - the chosen category
 * @returns whether a row was written
 */
export async function setMovementCategory(
  actorId: string,
  id: string,
  categoryId: string
): Promise<boolean> {
  const { count } = await db.movement.updateMany({
    where: { id, account: visibleTo(actorId) },
    data: { categoryId, categorySource: "MANUAL" },
  })

  return count > 0
}
```

and extend `getMovement`'s selection with the category and both link sides:

```ts
      category: { select: { name: true } },
      transferFrom: {
        select: {
          toMovement: {
            select: {
              id: true,
              description: true,
              account: { select: { name: true } },
            },
          },
        },
      },
      transferTo: {
        select: {
          fromMovement: {
            select: {
              id: true,
              description: true,
              account: { select: { name: true } },
            },
          },
        },
      },
```

mapping the twin as whichever of the two is present, and `null` when neither is.

- [ ] **Step 2: Write the form**

`components/finance/movement-category-form.tsx`, a client component built from
`PageForm`, `SelectField`, `TextField` and `Checkbox`:

| Field | Control | Label |
| --- | --- | --- |
| `categoryId` | `SelectField` over the unarchived categories | Categoria |
| `remember` | `Checkbox`, ticked by default when the movement has no category | Ricorda questa scelta |
| `pattern` | `TextField`, prefilled from `suggestPattern` | Quando la descrizione contiene |
| `backfill` | `Checkbox` | Applica anche ai movimenti passati |

The select needs the `items` map — a Base UI `Select` whose values differ from
its labels renders the raw value otherwise, and this one would show a cuid.

Its footer is a single `outline` button reading «Salva la categoria», matching
`PurchaseTotalForm` and `MovementNoteForm`: this is a form in the middle of a
page of readings.

The confirmation comes from `PageForm`'s own `FormMessage` — the action returns
`success(...)` and `FormMessage` knows the tone. Do not add a second message.

- [ ] **Step 3: Write the action**

In `app/(app)/finance/movements/[id]/actions.ts`, add `saveMovementCategory`.
It validates `{ id, categoryId, remember, pattern, backfill }` with a Zod
object built from `MovementIdSchema`, `CategoryIdSchema` and the rule's pattern
rule, calls `requireSession()`, then in order:

1. `setMovementCategory(userId, id, categoryId)` — false means gone, refuse;
2. when `remember`, `createRule({ kind: "DESCRIPTION_CONTAINS", pattern, categoryId, accountId: null })`;
3. when `remember && backfill`, `applyRulesToPast(userId)`.

It returns one `success` sentence naming what happened, built from the parts
that ran: «Categoria salvata.», plus «Regola creata.», plus «N movimenti
aggiornati.» — assembled with `countLabel` for the last, so one and many agree.

Add `unlinkMovementTransfer(id: string)`, which validates the id, calls
`requireSession()` and `unlinkTransfer`, then `revalidatePath`.

Both end with `revalidatePath` for `/finance`, `/finance/movements` and the
movement itself.

- [ ] **Step 4: Put them on the page**

In the detail page, the second `DetailSection` — «Le tue decisioni» — holds, in
order: the category form, then the twin.

When a twin exists, a `DataRow` labelled «Trasferimento» whose value links to
the twin, with a «Scollega» button beside it calling
`unlinkMovementTransfer`. When none exists, one muted line: «Nessun
trasferimento collegato.» — no button to link from here; the pairing screen is
where that is done, and a picker over two thousand movements is not.

The note form stays below, under its own heading.

- [ ] **Step 5: Verify and commit**

Run: `pnpm verify`

```bash
git add app/\(app\)/finance/movements components/finance/movement-category-form.tsx lib/services/finance/movements.ts
git commit -m "feat: one form for the category, the rule and the backfill

The design asked these as three questions in sequence. Asked one round
trip at a time they are three screens for what is one decision, so the
movement screen asks them together and answers in one sentence saying
what actually happened.

A category chosen here is MANUAL, which is what makes it survive the
next rule applied backwards.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: The rules and categories screens

**Files:**

- Create: `app/(app)/finance/rules/page.tsx`
- Create: `app/(app)/finance/rules/actions.ts`
- Create: `app/(app)/finance/rules/error.tsx`
- Create: `app/(app)/finance/rules/loading.tsx`
- Create: `app/(app)/finance/categories/page.tsx`
- Create: `app/(app)/finance/categories/actions.ts`
- Create: `app/(app)/finance/categories/error.tsx`
- Create: `app/(app)/finance/categories/loading.tsx`
- Create: `components/finance/rule-form.tsx`
- Create: `components/finance/category-form.tsx`

**Interfaces:**

- Consumes: `listRules`, `createRule`, `deleteRule`, `moveRule`,
  `listCategories`, `createCategory`, `updateCategory`, `applyRulesToPast`,
  `listAccounts`.
- Produces: the routes `/finance/rules` and `/finance/categories`.

Neither is in the nav, per §2.2: they are reached from the summary and from the
movement that made you want one.

- [ ] **Step 1: The rules screen**

`ListBody`, `PageHeader title="Regole"` with `back` to `/finance`, and a
`Button` linking to `/finance/categories` labelled «Categorie».

Above the list, one muted line saying what the order means: «Vince la prima
regola che corrisponde. Le regole sulla descrizione vengono provate prima di
quelle sulla categoria del servizio.»

Then `DataList` of `DataListRow` without `href` — a rule is not a page — each
row titled `«${RULE_KIND_LABELS[rule.kind]} "${rule.pattern}"»`, with the
category name, the account name or «tutti i conti», and three icon buttons:
up, down, and delete. Use `lucide-react`'s `ChevronUp`, `ChevronDown` and
`Trash2` inside `Button variant="ghost" size="icon"`, each with an `aria-label`
naming the rule — «Sposta prima la regola ESSELUNGA», not «Sposta prima».

Below the list, the `RuleForm` for adding one, and a separate «Applica le regole
ai movimenti passati» button whose action calls `applyRulesToPast` and reports
the count.

Empty state: «Nessuna regola.» with the description «Le regole si scrivono più
comodamente da un movimento: scegli la categoria e spunta "ricorda questa
scelta".»

- [ ] **Step 2: The rule form**

`components/finance/rule-form.tsx`, a client component: `SelectField` for the
kind (`RULE_KIND_LABELS`), `TextField` for the pattern, `SelectField` for the
category, `SelectField` for the account with a first option «Tutti i conti»
whose value is the empty string. Footer: `FormActions` with
`submitLabel="Aggiungi la regola"`.

- [ ] **Step 3: The categories screen**

`ListBody`, `PageHeader title="Categorie"` with `back` to `/finance/rules`.
`DataList` of `DataListRow` without `href`, each row titled with the name and
carrying a `Badge` with `CATEGORY_KIND_LABELS[kind]`, the count «usata in N
movimenti», and «archiviata» when it is. Editing happens in place through a
`FormDrawer` opened by a pencil button, the same shape the shopping row uses.

The `TRANSFER` category is not editable to a different kind: the row shows the
kind as text rather than a select when `kind === "TRANSFER"`, and the action
refuses a change of kind on it. Confirming a transfer depends on exactly one
existing, and letting the last one be renamed into an expense breaks a screen
nobody would connect to this one.

- [ ] **Step 4: The actions**

`rules/actions.ts` holds `addRule: FormAction`, `removeRule(id: string)`,
`reorderRule(id: string, direction: "up" | "down")` and
`runRulesOnPast(): Promise<FormState>`. `categories/actions.ts` holds
`saveCategory: FormAction`. All validate with Zod first, then `requireSession()`,
then act, then `revalidatePath` for `/finance`, `/finance/movements`,
`/finance/rules` and `/finance/categories`.

`saveCategory` maps `CategoryExistsError` to a field error on `name`:
«Esiste già una categoria con questo nome.»

- [ ] **Step 5: Verify and commit**

Run: `pnpm verify`

```bash
git add app/\(app\)/finance/rules app/\(app\)/finance/categories components/finance/rule-form.tsx components/finance/category-form.tsx
git commit -m "feat: the rules in the order they are tried, and the words they assign

The screen says what the order means, because "first match wins" is
invisible in a list and it is the whole behaviour.

The transfer category cannot be turned into an expense. Confirming a
pair depends on exactly one existing, and that dependency is two
screens away from here — the kind of break nobody would connect back
to the rename that caused it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: The pairing screen and the summary

**Files:**

- Create: `app/(app)/finance/transfers/page.tsx`
- Create: `app/(app)/finance/transfers/actions.ts`
- Create: `app/(app)/finance/transfers/error.tsx`
- Create: `app/(app)/finance/transfers/loading.tsx`
- Create: `components/finance/transfer-candidate.tsx`
- Modify: `app/(app)/finance/page.tsx`

**Interfaces:**

- Consumes: `listTransferCandidates`, `confirmTransfer`,
  `countTransferCandidates`, `countUncategorised`, `monthSummary`,
  `listAccounts`, `monthFromKey`, `monthKeyOf`, `monthStartFor`, `addMonths`.
- Produces: the route `/finance/transfers`, and the summary of §9.1.

- [ ] **Step 1: The pairing screen**

`ListBody`, `PageHeader title="Trasferimenti da confermare"` with `back` to
`/finance`.

One muted line first: «Finché non li confermi, questi movimenti contano come
entrate e come uscite.» That is the truth of §8.2 and the reason to be on the
screen.

Then the settled candidates, each a `Card` holding two `DataRow`s — the outgoing
and the incoming, each with its account, date and amount — and a «Conferma»
button. Above them, when there is more than one, a «Conferma tutti» button.

Then, under a `DetailSection title="Da scegliere"`, the contested ones, grouped
by their shared leg, with the same card shape and no bulk button. A muted line
explains why: «Questi movimenti hanno più di un possibile gemello. Scegline uno.»

Empty state: «Nessun trasferimento da confermare.»

- [ ] **Step 2: The actions**

`transfers/actions.ts`:

```ts
"use server"
```

`confirmPair(outgoingId: string, incomingId: string)` validates both ids with
`MovementIdSchema`, calls `requireSession()`, then `confirmTransfer`, catching
`TransferNotPairableError` and returning without throwing — the pairing may have
been confirmed from the other phone between the render and the tap, and that is
a race, not an error to shout about.

`confirmAllSettled()` reads the candidates again server-side and confirms only
the settled ones, one at a time, ignoring the same error for the same reason.
**It does not take a list from the client**: a payload naming pairs would let a
forged call link two movements that are not a pair, and a forged transfer hides
an expense in the one category the totals ignore.

Both end with `revalidatePath` for `/finance`, `/finance/movements` and
`/finance/transfers`.

- [ ] **Step 3: The summary**

Rewrite `app/(app)/finance/page.tsx`, keeping the balances section exactly as it
is and adding, in the order of §9.1:

1. **Calls to action**, above the balances, each an `Alert` with a link, and
   each absent when its count is zero:
   - `countUncategorised` → `/finance/movements?category=uncategorised`,
     reading «N movimenti da categorizzare» through `countLabel`;
   - `countTransferCandidates` → `/finance/transfers`, reading «N trasferimenti
     da confermare», with the description «Finché non li confermi, i totali qui
     sotto non sono ancora veri.»
2. The balances, unchanged.
3. **The month**, in a `DetailSection` whose title is the month in Italian
   («agosto 2026»), with a `‹` link to the previous month and a `›` to the next
   — the next hidden when the month on screen is the current one. The month
   comes from `?month=` through `monthFromKey`, falling back to
   `monthStartFor(new Date())` when absent or unreadable. Three `DataRow`s:
   «Entrate», «Uscite», «Differenza».
4. **Outgoings by category**, a `CardList` of `DataListRow`s linking to
   `/finance/movements?category=<id>`, each titled with the category name,
   carrying the amount and the comparison: «di solito 110,00 €» when a mean
   exists, «primo mese» when it does not.

Add a link to `/finance/rules` in the existing «Vai a» section.

- [ ] **Step 4: Verify and commit**

Run: `pnpm verify`

```bash
git add app/\(app\)/finance components/finance/transfer-candidate.tsx
git commit -m "feat: the two questions, answered

The summary leads with what is not yet true: an unconfirmed transfer
counts as both income and an outgoing, so the count of pairs waiting is
a call to action above the numbers rather than a note beneath them.

Confirming in bulk reads the candidates again on the server instead of
taking a list from the client. A forged pair would hide an expense in
the one category the totals ignore, which is the quietest possible way
for this module to lie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Manual checklist

At 390 px, signed in, with at least two accounts holding an imported month.

**Categories and rules**

1. `/finance/categories` lists the thirteen seeded categories with their kind.
2. Renaming one to a name already taken is refused, with the message on the
   name field and the typed value still there.
3. The «Trasferimento» category does not offer a kind select.

**Categorising**

4. On an uncategorised movement, the category select lists the categories by
   name — not by id — and «Ricorda questa scelta» is ticked by default.
5. The suggested pattern for «Pagamento POS — ESSELUNGA SPA, MILANO» is
   `ESSELUNGA`, and it is editable.
6. Saving with the rule and the backfill both ticked reports all three parts in
   one sentence, and the confirmation is **not** red.
7. `/finance/rules` shows the new rule first in the list.
8. A movement categorised by hand **keeps** its category after «Applica le regole
   ai movimenti passati», even when a rule would assign a different one. Set one
   by hand to a deliberately wrong category and prove it survives.
9. `/finance/movements` gains the category chips; the row scrolls sideways and
   the last chip is reachable. Choosing one narrows the list and keeps `q`.
10. «Da categorizzare» shows only the ones with no category.

**Transfers**

11. Import two accounts holding a matching pair — a −200 and a +200 within four
    days. `/finance/transfers` offers it as settled.
12. Confirming it moves both movements to «Trasferimento», and the pair
    disappears from the screen.
13. On the movement detail, the twin is named and links to the other leg.
14. «Scollega» breaks the pair, and both legs go back to «Da categorizzare» or
    to whatever a rule now says — never staying on «Trasferimento».
15. A movement with two possible twins appears under «Da scegliere» and is not
    offered to «Conferma tutti».

**The summary**

16. With uncategorised movements, `/finance` leads with the count and the link
    works.
17. Income and outgoings **exclude** confirmed transfers. Confirm a pair and
    watch both numbers fall by the transferred amount.
18. The account balances **do not** change when a transfer is confirmed. This is
    the distinction that gets confused first.
19. The month steps backwards, the address gains `?month=2026-07`, and reloading
    keeps it. The forward arrow is absent on the current month.
20. A category with no earlier data reads «primo mese» rather than «di solito
    0,00 €».

## What this plan does not do

- **No spending ceilings.** §8.3 answers the question without them, and §11
  records why.
- **No LLM anywhere.** §6.1 decided it, not deferred it.
- **No linking a transfer by hand from the movement screen.** The pairing screen
  is where a pair is made; a picker over two thousand movements is not a control
  anybody would use. A movement that will never have a twin gets the
  «Trasferimento» category by hand instead, which is §7.4.
- **No roadmap update**, for as long as `fix/execution-history-foreign-key`
  holds an unmerged correction to that file.
