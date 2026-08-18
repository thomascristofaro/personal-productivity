# Shopping Done and the Purchase History Implementation Plan (C of three)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a shop from the till — what is ticked moves into a dated history with what it cost — and stop a later regeneration from putting back what has already been bought.

**Architecture:** Two new tables hanging off the week's `ShoppingList`, copied rows rather than referenced ones, and money as integer cents. The one interesting rule is in the aggregator: it now takes what has already been bought and subtracts it from what the menu asks for, so pressing «Rigenera» after a shop shows what is missing rather than what was needed.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`maia` / `olive` / `lime`).

**Spec:** `docs/superpowers/specs/2026-08-18-catalogue-and-purchases-design.md` — §8 (the models and the transaction), §9 (the screens), §10 (the subtraction and its four cases), §13 (testing), §15 (what is deliberately out).

**This is plan C of three.** It runs after **A** (`2026-08-18-catalogue.md`) and **B** (`2026-08-18-shopping-list-again.md`): it names `CatalogItem`, `mergeLines`, `groupByAisle` in its new home, and the `days` column.

**All three plans land on one branch, `docs/catalog-and-purchases-design`, and one pull request.** The roadmap's standing rule is one branch per plan; the owner overrode it on 2026-08-18, on the grounds that merging a branch that contains only a design document and three plans buys nothing. Each plan still ends with a working app and a green gate, so the branch is mergeable at every task boundary — it is just not merged until C is done.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited by this plan.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; add `nativeButton={false}` when `render` yields a non-button.
- **Use the page primitives.** `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton`, `DataList`, `DataListRow` in `components/page/`.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth` — `lib/config`, `lib/week`, `lib/units`, `lib/aisles` and the new `lib/money` are leaf modules and are allowed. `lib/schemas/**` imports Zod and its own siblings, nothing else. ESLint fails the build.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **`actorId` is reserved.** It comes from `requireSession()`, never from a form field.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws`. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads.** English for identifiers, comments, TSDoc, file names, commit messages.
- **Money is integer cents.** Never a float, never a Prisma `Decimal` — §8 says why.
- **Schema changes go through a migration.** Never edit the database by hand.
- **Phone first at 390px.** A fixed element at the foot needs `env(safe-area-inset-bottom)`.
- **`pnpm verify` is the gate.**

## Testing

Per `docs/conventions/testing.md`: the Zod schemas and the pure functions are tested; React components are not — `vitest.config.ts` runs `environment: "node"` with no DOM. The subtraction of §10 and the money parsing are where getting it wrong costs real money, and they get the tests.

## The shell

If a command fails with `"node" non è riconosciuto`, the Git Bash `PATH` carries a broken `app.asar` entry:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

`git commit` does not need it. Never `--no-verify`. The owner runs `pnpm dev` on port 3000 — reuse it.

---

## File Structure

**Created**

| File                                             | Responsibility                                     |
| ------------------------------------------------ | -------------------------------------------------- |
| `prisma/migrations/<ts>_purchases/migration.sql` | `Purchase` and `PurchaseItem`                      |
| `lib/money.ts`                                   | `formatEuro` — a leaf module components may import |
| `lib/money.test.ts`                              | covers it                                          |
| `lib/services/purchases.ts`                      | closing a shop, the history, the total             |
| `components/shopping/complete-purchase-bar.tsx`  | the fixed bar and the drawer asking for the amount |
| `components/shopping/purchase-total-form.tsx`    | editing a total on the detail screen               |
| `app/(app)/spesa/storico/page.tsx`               | every purchase, newest first                       |
| `app/(app)/spesa/storico/loading.tsx`            | delegates to `ListSkeleton`                        |
| `app/(app)/spesa/storico/error.tsx`              | delegates to `PageError`                           |
| `app/(app)/spesa/storico/actions.ts`             | `saveTotal`                                        |
| `app/(app)/spesa/storico/[id]/page.tsx`          | one purchase, by aisle, total editable             |
| `app/(app)/spesa/storico/[id]/loading.tsx`       | delegates to `DetailSkeleton`                      |

**Modified**

| File                                      | Change                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `prisma/schema.prisma`                    | two models, and `ShoppingList.purchases`              |
| `lib/schemas/shopping.ts`                 | `EuroCentsSchema`, `PurchaseIdSchema`                 |
| `lib/schemas/shopping.test.ts`            | covers them                                           |
| `lib/services/shopping-aggregate.ts`      | `purchased` in, and the subtraction                   |
| `lib/services/shopping-aggregate.test.ts` | the helper gains a third argument; nine cases added   |
| `lib/services/shopping-lists.ts`          | loads the purchases and passes them to the aggregator |
| `lib/services/shopping-view.ts`           | `groupByAisle` becomes generic                        |
| `app/(app)/spesa/[weekStart]/page.tsx`    | the bar, when something is ticked                     |
| `app/(app)/spesa/[weekStart]/actions.ts`  | `complete`                                            |
| `components/app-nav.tsx`                  | «Storico spesa», after «Spesa»                        |
| `docs/roadmap.md`                         | a row in Shipped                                      |

---

## Task 1: The two tables

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_purchases/migration.sql` (generated)

**Interfaces:**

- Produces: `db.purchase`, `db.purchaseItem`, and `ShoppingList.purchases`.

- [ ] **Step 1: Add the models**

At the end of the application half of `prisma/schema.prisma` — before the better-auth block, which the comment there says is fixed by the adapter:

```prisma
// One trip to the shop. Hangs off the ShoppingList rather than off the week, so
// "what has already been bought for this list" is a single query — that is what
// stops a regeneration putting the tomatoes back. See the design document of
// 2026-08-18, sections 8 and 10.
model Purchase {
  id          String         @id @default(cuid())
  listId      String
  list        ShoppingList   @relation(fields: [listId], references: [id], onDelete: Cascade)
  purchasedAt DateTime       @default(now())
  // Integer cents, not Decimal: a Prisma Decimal does not survive the
  // server-to-client component boundary, so every read would need a conversion
  // by hand and a forgotten one is a runtime error rather than a type error.
  // Nullable because the amount can be filled in later, when the receipt is to
  // hand.
  totalCents  Int?
  items       PurchaseItem[]

  @@index([listId])
}

// A copy, not a reference. The shopping row is deleted when the shop closes, and
// a history must say what was bought then rather than what the catalogue says
// now.
model PurchaseItem {
  id         String   @id @default(cuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  name       String
  quantity   Float?
  unit       String?
  aisle      String

  @@index([purchaseId])
}
```

and in `model ShoppingList`, one line:

```prisma
  purchases   Purchase[]
```

- [ ] **Step 2: Migrate**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:migrate --name purchases
pnpm db:generate
```

Read the generated SQL before letting it run: it should be two `CREATE TABLE`, two `CREATE INDEX` and two `ADD CONSTRAINT`, and nothing else. Anything that drops or alters an existing table means the schema was edited wrongly.

- [ ] **Step 3: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add prisma
git commit -m "feat: a shopping list can record the trips made against it

Purchase hangs off the ShoppingList and not off the week, which is what makes
\"already bought for this list\" one query. PurchaseItem copies the row rather
than referencing it: the shopping row is deleted when the shop closes, and a
history must say what was bought then.

The total is integer cents. A Prisma Decimal does not cross the
server-to-client component boundary, so every read would need a hand
conversion and a forgotten one is a runtime error rather than a type error.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Money

**Files:**

- Create: `lib/money.ts`, `lib/money.test.ts`
- Modify: `lib/schemas/shopping.ts`, `lib/schemas/shopping.test.ts`

**Interfaces:**

- Produces:
  - `formatEuro(cents: number): string` — `1234` → `"12,34 €"`
  - `EuroCentsSchema` — a string in, `number | null` out
  - `PurchaseIdSchema` — a cuid

- [ ] **Step 1: Write the failing tests**

`lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { formatEuro } from "@/lib/money"

// Intl puts a non-breaking space before the symbol. Normalising it here keeps
// the assertions readable and the test honest about what is actually compared.
const plain = (value: string) => value.replace(/ /g, " ")

describe("formatEuro", () => {
  it("renders cents as Italian currency", () => {
    expect(plain(formatEuro(1234))).toBe("12,34 €")
  })

  it("keeps both decimals on a round amount", () => {
    expect(plain(formatEuro(1200))).toBe("12,00 €")
  })

  it("renders nothing spent as zero rather than as blank", () => {
    expect(plain(formatEuro(0))).toBe("0,00 €")
  })

  it("groups the thousands the Italian way", () => {
    expect(plain(formatEuro(123456))).toBe("1.234,56 €")
  })
})
```

Append to `lib/schemas/shopping.test.ts`:

```ts
describe("EuroCentsSchema", () => {
  it("takes the comma an Italian keyboard produces", () => {
    expect(EuroCentsSchema.parse("12,34")).toBe(1234)
  })

  it("takes a dot too, because a numeric keypad may give one", () => {
    expect(EuroCentsSchema.parse("12.34")).toBe(1234)
  })

  it("takes a whole number of euro", () => {
    expect(EuroCentsSchema.parse("12")).toBe(1200)
  })

  it("takes a single decimal", () => {
    expect(EuroCentsSchema.parse("12,5")).toBe(1250)
  })

  it("accepts nothing spent", () => {
    expect(EuroCentsSchema.parse("0")).toBe(0)
  })

  it("reads an empty field as an amount to fill in later", () => {
    expect(EuroCentsSchema.parse("")).toBeNull()
    expect(EuroCentsSchema.parse("   ")).toBeNull()
  })

  it("refuses a negative amount, which no shop produces", () => {
    expect(EuroCentsSchema.safeParse("-1").success).toBe(false)
  })

  it("refuses three decimals, because that is a typo rather than a price", () => {
    expect(EuroCentsSchema.safeParse("12,345").success).toBe(false)
  })

  it("refuses words", () => {
    expect(EuroCentsSchema.safeParse("dodici").success).toBe(false)
  })

  it("refuses a thousands separator, and says so in Italian", () => {
    const result = EuroCentsSchema.safeParse("1.234,56")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Scrivi l’importo come 12,34, senza separatore delle migliaia."
      )
    }
  })

  it("refuses an amount no weekly shop reaches, so a slipped key is caught", () => {
    expect(EuroCentsSchema.safeParse("100000").success).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/money.test.ts lib/schemas/shopping.test.ts
```

Expected: FAIL — neither module exports what is asked for.

- [ ] **Step 3: Implement them**

`lib/money.ts`:

```ts
// Money is held as integer cents everywhere — see the design document of
// 2026-08-18, section 8. This module is the only place it becomes a string, so
// the app cannot end up with two spellings of the same amount.

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
})

/**
 * Renders an amount in cents as Italian currency.
 *
 * @param cents - the amount, as the database holds it
 * @returns the amount with its symbol, for example "12,34 €"
 */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100)
}
```

In `lib/schemas/shopping.ts`:

```ts
export const PurchaseIdSchema = z.cuid("Questa spesa non è valida.")

// Ten thousand euro. Far above any weekly shop and far below what a slipped
// key produces, which is the point: this catches 100000 typed for 100,00.
const MAX_CENTS = 1_000_000

const AMOUNT = /^\d+([.]\d{1,2})?$/

/**
 * The amount paid, as typed. Empty means "not yet", which is a real state:
 * a shop can be closed at the till and priced when the receipt is to hand.
 */
export const EuroCentsSchema = z
  .string()
  .trim()
  // One comma, because an Italian keyboard gives a comma and a numeric keypad
  // gives a dot. A thousands separator therefore fails the pattern below, and
  // the message says so rather than silently reading 1.234,56 as something else.
  .transform((value) => value.replace(",", "."))
  .refine((value) => value === "" || AMOUNT.test(value), {
    message: "Scrivi l’importo come 12,34, senza separatore delle migliaia.",
  })
  .transform((value) => (value === "" ? null : Math.round(Number(value) * 100)))
  .refine((cents) => cents === null || cents <= MAX_CENTS, {
    message: "L’importo sembra troppo alto. Controlla la virgola.",
  })
```

`Math.round` and not a bare multiplication: `12.34 * 100` is `1233.9999999999998`, and truncating it would lose a cent on roughly every third amount.

- [ ] **Step 4: Run them and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/money.test.ts lib/schemas/shopping.test.ts
```

Expected: PASS, fifteen new cases.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts lib/schemas
git commit -m "feat: an amount paid, parsed from what a phone keyboard gives

Comma and dot both mean a decimal point; a thousands separator is refused with
a message that says so, rather than being read as something else. Ten thousand
euro is the cap: far above a weekly shop, far below what 100000 typed for
100,00 produces.

Math.round and not a bare multiplication — 12.34 * 100 is 1233.9999999999998,
and truncating loses a cent on roughly every third amount.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The subtraction

The rule of §10, and the reason this plan is not just two tables and a screen. Pure, so it is tested.

**Files:**

- Modify: `lib/services/shopping-aggregate.ts`, `lib/services/shopping-aggregate.test.ts`

**Interfaces:**

- Produces:

```ts
export type PurchasedTotal = {
  name: string
  unit: string | null
  quantity: number | null
}

export function aggregateShoppingList(input: {
  slots: AggregatorSlot[]
  existing: ShoppingItem[]
  purchased: PurchasedTotal[]
}): ShoppingItem[]
```

`purchased` is required, not optional. An optional input that silently defaults to "nothing bought" is exactly the mistake this rule exists to prevent, and a required one makes the compiler point at every caller.

- [ ] **Step 1: Write the failing tests**

In `lib/services/shopping-aggregate.test.ts`, widen the helper:

```ts
const aggregate = (
  slots: AggregatorSlot[],
  existing: ShoppingItem[] = [],
  purchased: PurchasedTotal[] = []
) => aggregateShoppingList({ slots, existing, purchased })
```

and add:

```ts
describe("what has already been bought", () => {
  const bought = (over: Partial<PurchasedTotal> = {}): PurchasedTotal => ({
    name: "spaghetti",
    unit: "g",
    quantity: 320,
    ...over,
  })

  it("drops a line whose whole quantity has been bought", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 320, unit: "g" }])],
      [],
      [bought()]
    )

    expect(result).toEqual([])
  })

  it("leaves the remainder when the menu now asks for more", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ quantity: 300 })]
    )

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(200)
  })

  it("drops a line bought more than once, summing the trips", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ quantity: 300 }), bought({ quantity: 200 })]
    )

    expect(result).toEqual([])
  })

  it("drops an unquantified line once anything of it has been bought", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: null, unit: null }])],
      [],
      [bought({ unit: null, quantity: null })]
    )

    expect(result).toEqual([])
  })

  it("treats a purchase with no quantity as satisfying the whole line", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ quantity: null })]
    )

    expect(result).toEqual([])
  })

  it("subtracts nothing across two different units", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ unit: "confezione", quantity: 2 })]
    )

    expect(result[0].quantity).toBe(500)
  })

  it("subtracts nothing for a name the menu no longer asks for", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ name: "pomodori", quantity: 400 })]
    )

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(500)
  })

  it("leaves a line added by hand alone, whatever has been bought", () => {
    const result = aggregate(
      [],
      [item({ name: "spaghetti", quantity: 320, unit: "g", manual: true })],
      [bought()]
    )

    expect(result).toHaveLength(1)
  })

  it("rounds a countable remainder up, never to a fraction of a thing", () => {
    const result = aggregate(
      [slot([{ name: "uova", quantity: 6, unit: null }])],
      [],
      [{ name: "uova", unit: null, quantity: 4.5 }]
    )

    expect(result[0].quantity).toBe(2)
  })
})
```

The last case is the one that would otherwise ship wrong: 6 minus 4.5 is 1.5 eggs, and half an egg is not something a shop sells.

The manual case matters too, and its reasoning is the opposite of what it looks like: a hand-added row is never regenerated, so subtracting from it would be subtracting from something the aggregator does not produce.

- [ ] **Step 2: Run them and watch them fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-aggregate.test.ts
```

Expected: FAIL — `purchased` is not a property of the input, and `PurchasedTotal` is not exported.

- [ ] **Step 3: Implement it**

In `lib/services/shopping-aggregate.ts`:

```ts
/** One line of one past trip, as it needs to be seen from here. */
export type PurchasedTotal = {
  name: string
  unit: string | null
  quantity: number | null
}

type Bought = { quantity: number; satisfied: boolean }

// A purchase with no quantity says "I bought this", not "I bought none of it".
// It therefore satisfies the line whatever the menu now asks for, and no
// arithmetic can express that — hence the flag beside the sum.
function boughtByKey(purchased: PurchasedTotal[]): Map<string, Bought> {
  const bought = new Map<string, Bought>()

  for (const row of purchased) {
    const key = itemKey(row.name, row.unit)
    const current = bought.get(key) ?? { quantity: 0, satisfied: false }

    bought.set(key, {
      quantity: current.quantity + (row.quantity ?? 0),
      satisfied: current.satisfied || row.quantity === null,
    })
  }

  return bought
}
```

In `aggregateShoppingList`, take the third input and filter the generated lines through it. The mapping becomes a `flatMap` so a satisfied line can produce nothing:

```ts
const bought = boughtByKey(purchased)

const generated = totalsFor(slots).flatMap<ShoppingItem>((total) => {
  const key = itemKey(total.name, total.unit)
  const prior = previous.get(key)
  const already = bought.get(key)

  const required =
    total.quantity === null ? null : round(total.quantity, total.unit)

  // Nothing bought for this line: it is whatever the menu asks for.
  // Something bought and the line unquantified, or a purchase that named no
  // quantity: the line is done — "olio" bought is olio bought.
  let quantity: number | null = required
  if (already !== undefined) {
    if (required === null || already.satisfied) return []
    const remaining = round(required - already.quantity, total.unit)
    if (remaining <= 0) return []
    quantity = remaining
  }

  // A tick means "I have enough of this". If the list now asks for more than
  // it did before, that stops being true, so the tick — and who and when —
  // does not survive. A lower or unquantified either side still means what
  // it meant, so those keep the tick.
  const quantityRose =
    prior !== undefined &&
    prior.quantity !== null &&
    quantity !== null &&
    quantity > prior.quantity

  return [
    {
      name: total.name,
      quantity,
      unit: total.unit,
      aisle: total.aisle,
      days: [...total.days].sort((a, b) => a - b),
      checked: quantityRose ? false : (prior?.checked ?? false),
      checkedById: quantityRose ? null : (prior?.checkedById ?? null),
      checkedAt: quantityRose ? null : (prior?.checkedAt ?? null),
      manual: false,
    },
  ]
})
```

The `quantityRose` block and the returned object are what the function already
had, moved inside the `flatMap` and wrapped in an array. The only new field in
the object is `days`, which plan B added.

`round` is applied again after the subtraction and not only before: it is what turns 1.5 eggs into 2 and what keeps a weight from carrying floating-point noise the shopper would read.

Note what is _not_ changed: `existing` still carries the manual rows through untouched at the bottom of the function, so the "leaves a line added by hand alone" case passes without a line of code for it. That is the design working, not a gap.

- [ ] **Step 4: Run them and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-aggregate.test.ts
```

Expected: PASS — the nine new cases and every one that was there before.

- [ ] **Step 5: Feed it from the database**

In `lib/services/shopping-lists.ts`, `regenerateShoppingList`'s `select` for `list` gains the purchases, in the same round trip:

```ts
      list: {
        select: {
          id: true,
          items: { select: itemFields },
          purchases: {
            select: {
              items: { select: { name: true, unit: true, quantity: true } },
            },
          },
        },
      },
```

and the call:

```ts
const next = aggregateShoppingList({
  slots,
  existing: menu.list?.items ?? [],
  purchased: (menu.list?.purchases ?? []).flatMap((purchase) => purchase.items),
})
```

- [ ] **Step 6: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add lib/services
git commit -m "feat: regenerating subtracts what has already been bought

Without this, buying the tomatoes on Monday and changing the menu on Wednesday
puts them back. The rule extends the one the aggregator already had for ticks —
a tick that stops being true when the quantity rises — from \"I have enough\" to
\"I have bought some\".

A purchase naming no quantity satisfies the line whatever the menu now asks:
olio bought is olio bought, and no arithmetic expresses that, hence the flag
beside the sum. The remainder is rounded after the subtraction as well as
before, or six eggs less four and a half is one and a half eggs.

purchased is a required input, not an optional one. An input that silently
defaults to \"nothing bought\" is the exact mistake this rule prevents.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Closing a shop

**Files:**

- Create: `lib/services/purchases.ts`
- Modify: `lib/services/shopping-view.ts` — `groupByAisle` becomes generic
- Modify: `app/(app)/spesa/[weekStart]/actions.ts`

**Interfaces:**

- Consumes: `NoListError` from `lib/services/shopping-lists`.
- Produces:

```ts
export class NothingCheckedError extends Error {}

export type PurchaseSummary = {
  id: string
  purchasedAt: Date
  weekStart: Date
  itemCount: number
  totalCents: number | null
}

export type PurchaseLine = {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
}

export type PurchaseDetail = {
  id: string
  purchasedAt: Date
  weekStart: Date
  totalCents: number | null
  lines: PurchaseLine[]
}

export async function completePurchase(
  weekStart: Date,
  totalCents: number | null
): Promise<void>
export async function listPurchases(): Promise<PurchaseSummary[]>
export async function getPurchase(id: string): Promise<PurchaseDetail | null>
export async function setPurchaseTotal(
  id: string,
  totalCents: number | null
): Promise<void>
```

- [ ] **Step 1: Make `groupByAisle` generic**

The purchase detail wants the same walking order, and its rows have no ids-plural, no days and no ticks. Widening the signature is cheaper and truer than a second implementation. In `lib/services/shopping-view.ts`:

```ts
export type AisleGroup<T> = { aisle: string; lines: T[] }

/**
 * Gathers anything with a name and an aisle into the supermarket walking order.
 *
 * Generic because two screens want it: the shopping list, whose lines are
 * merged rows, and one past purchase, whose lines are copies. Sorts as well as
 * groups — the rows arrive from Postgres in whatever order it liked and no SQL
 * `ORDER BY` can express a walking order that is not alphabetical.
 *
 * @param lines Every line, in any order.
 * @returns One group per aisle that has lines, in walking order, each group's
 *   lines by name.
 */
export function groupByAisle<T extends { aisle: string; name: string }>(
  lines: T[]
): AisleGroup<T>[] {
  … the body is unchanged …
}
```

`app/(app)/spesa/[weekStart]/page.tsx` and `components/shopping/shopping-list.tsx` need no change: `AisleGroup<MergedLine>` is what they already receive, and the row component declares its own shape.

- [ ] **Step 2: The service**

`lib/services/purchases.ts`:

```ts
import { db } from "@/lib/db"
import { NoListError } from "@/lib/services/shopping-lists"

/** Thrown when a shop is closed with nothing ticked. */
export class NothingCheckedError extends Error {
  constructor() {
    super("No item is checked.")
    this.name = "NothingCheckedError"
  }
}

export type PurchaseSummary = {
  id: string
  purchasedAt: Date
  weekStart: Date
  itemCount: number
  totalCents: number | null
}

export type PurchaseLine = {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
}

export type PurchaseDetail = {
  id: string
  purchasedAt: Date
  weekStart: Date
  totalCents: number | null
  lines: PurchaseLine[]
}

/**
 * Moves everything ticked off the list into a dated purchase.
 *
 * The read and the write are one transaction, so a tick arriving from the other
 * phone between them cannot be half-recorded. Copies rather than references: a
 * history must say what was bought then, and the rows themselves go.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param totalCents What was paid, or null to fill in later.
 * @returns Nothing.
 * @throws NoListError When the week has no list.
 * @throws NothingCheckedError When nothing on it is ticked.
 */
export async function completePurchase(
  weekStart: Date,
  totalCents: number | null
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  const listId = menu.list.id

  await db.$transaction(async (tx) => {
    const checked = await tx.shoppingListItem.findMany({
      where: { listId, checked: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        aisle: true,
      },
    })

    if (checked.length === 0) throw new NothingCheckedError()

    await tx.purchase.create({
      data: {
        listId,
        totalCents,
        items: {
          create: checked.map(({ id: _id, ...line }) => line),
        },
      },
      select: { id: true },
    })

    await tx.shoppingListItem.deleteMany({
      where: { id: { in: checked.map((line) => line.id) } },
    })
  })
}

/**
 * Every purchase ever made, newest first.
 *
 * Crosses the weeks on purpose: seeing the spend is the point, and a history
 * paged by week could not show it. Small enough to load whole — one household,
 * a handful of trips a week.
 *
 * @returns Every purchase, with its week and how many lines it holds.
 */
export async function listPurchases(): Promise<PurchaseSummary[]> {
  const rows = await db.purchase.findMany({
    select: {
      id: true,
      purchasedAt: true,
      totalCents: true,
      list: { select: { menu: { select: { weekStart: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { purchasedAt: "desc" },
  })

  return rows.map((row) => ({
    id: row.id,
    purchasedAt: row.purchasedAt,
    weekStart: row.list.menu.weekStart,
    itemCount: row._count.items,
    totalCents: row.totalCents,
  }))
}

/**
 * Reads one purchase and everything in it.
 *
 * @param id The purchase's id.
 * @returns The purchase, or null when there is no such id.
 */
export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const row = await db.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      purchasedAt: true,
      totalCents: true,
      list: { select: { menu: { select: { weekStart: true } } } },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          aisle: true,
        },
      },
    },
  })

  if (row === null) return null

  return {
    id: row.id,
    purchasedAt: row.purchasedAt,
    weekStart: row.list.menu.weekStart,
    totalCents: row.totalCents,
    lines: row.items,
  }
}

/**
 * Sets or clears what a purchase cost.
 *
 * @param id The purchase's id.
 * @param totalCents The amount, or null to say it is not known yet.
 * @returns Nothing.
 */
export async function setPurchaseTotal(
  id: string,
  totalCents: number | null
): Promise<void> {
  // updateMany rather than update: an id that no longer exists is a race with
  // the other phone, not an error worth throwing at the user.
  await db.purchase.updateMany({ where: { id }, data: { totalCents } })
}
```

- [ ] **Step 3: The action**

In `app/(app)/spesa/[weekStart]/actions.ts`. The state type is imported from the component that renders it, the way `SlotFormState` already is — Task 5 writes it, so do Task 5 Step 1 first or accept a red `tsc` between the two:

```ts
import type { CompleteState } from "@/components/shopping/complete-purchase-bar"

export async function complete(
  _state: CompleteState,
  formData: FormData
): Promise<CompleteState> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  if (!weekStart.success) return { ok: false, message: "Settimana non valida." }
  if (!total.success) {
    return { ok: false, message: total.error.issues[0].message }
  }

  await requireSession()

  try {
    await completePurchase(weekStart.data, total.data)
  } catch (error) {
    if (error instanceof NoListError) {
      return { ok: false, message: "Questa settimana non ha una lista." }
    }
    // The other phone closed the shop first, or unticked everything between the
    // render and the tap. Saying so is better than a silent no-op.
    if (error instanceof NothingCheckedError) {
      return { ok: false, message: "Non c’è niente di spuntato." }
    }
    throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
  revalidatePath("/spesa/storico")
  return { ok: true, message: null }
}
```

- [ ] **Step 4: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add lib/services app/\(app\)/spesa
git commit -m "feat: closing a shop moves what is ticked into a dated purchase

The read and the write are one transaction: a tick arriving from the other
phone between them would otherwise be half-recorded.

groupByAisle becomes generic. The purchase detail wants the same walking order
over rows that have no ids-plural, no days and no ticks, and widening the
signature is cheaper and truer than a second implementation.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: The bar at the till

**Files:**

- Create: `components/shopping/complete-purchase-bar.tsx`
- Modify: `app/(app)/spesa/[weekStart]/page.tsx`

**Interfaces:**

- Consumes: the `complete` action from Task 4.
- Produces: `CompleteState = { ok: boolean; message: string | null }`, which Task 4's action imports, and `CompletePurchaseBar`, taking `weekStart: string`, `checkedCount: number` and the action.

- [ ] **Step 1: The component**

```tsx
"use client"

import { useActionState, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAttempt } from "@/hooks/use-attempt"

export type CompleteState = { ok: boolean; message: string | null }

export type CompleteAction = (
  state: CompleteState,
  formData: FormData
) => Promise<CompleteState>

const EMPTY: CompleteState = { ok: false, message: null }

export function CompletePurchaseBar({
  weekStart,
  checkedCount,
  action,
}: {
  weekStart: string
  checkedCount: number
  action: CompleteAction
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(action, EMPTY)
  const attempt = useAttempt(state)

  useEffect(() => {
    if (state.ok) setOpen(false)
  }, [state])

  // Rendered by the server from what is actually stored, so it trails an
  // optimistic tick by one round trip. That is the honest number: closing a
  // shop against a tick the server has not seen would leave the line behind.
  if (checkedCount === 0) return null

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {/* Fixed rather than sticky: the list scrolls behind it, and at the till
          the thumb is at the bottom of the phone. The inset keeps it clear of
          the home indicator once the app is installed. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button className="w-full" onClick={() => setOpen(true)}>
          Spesa completata ({checkedCount})
        </Button>
      </div>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Spesa completata</DrawerTitle>
          <DrawerDescription>
            {checkedCount === 1
              ? "1 articolo passa nello storico e sparisce dalla lista."
              : `${checkedCount} articoli passano nello storico e spariscono dalla lista.`}
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />

          <Field key={attempt}>
            <FieldLabel htmlFor="total">Quanto hai pagato</FieldLabel>
            <Input
              id="total"
              name="total"
              type="text"
              inputMode="decimal"
              placeholder="12,34"
              autoComplete="off"
              aria-describedby="total-description"
            />
            <FieldDescription id="total-description">
              Puoi lasciarlo vuoto e metterlo dopo, dallo storico.
            </FieldDescription>
          </Field>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvo…" : "Conferma"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

`type="text"` and not `type="number"`: a number input refuses a comma in some locales and silently empties itself, and the parsing this field needs is already in `EuroCentsSchema`.

There is no separate «Salta» button. Confirming with the field empty _is_ skipping, and two buttons that both close the shop is one more decision at the till than the moment deserves — the description says so.

- [ ] **Step 2: Put it on the page**

In `app/(app)/spesa/[weekStart]/page.tsx`, after the `ShoppingList`:

```tsx
<CompletePurchaseBar
  weekStart={week}
  checkedCount={list.items.filter((item) => item.checked).length}
  action={complete}
/>
```

The count is over the stored rows, not the merged lines: what moves into the history is rows, and a part-ticked merged line contributes only its ticked half.

The bar covers the foot of the page, so `<main>` needs room under it. Add `pb-24` to the `main` className when a list exists — or unconditionally, which is simpler and costs an empty strip nobody scrolls to.

- [ ] **Step 3: Run the gate, the design skill, and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Run `web-design-guidelines` over `components/shopping/complete-purchase-bar.tsx` and the page. The fixed bar and the safe-area inset are exactly what it is good at catching.

```bash
git add app components
git commit -m "feat: a bar at the foot closes the shop and asks what it cost

At the foot and not in the header: three controls at 390px is one too many, and
this is the action taken at the till with a thumb. It appears only when
something is ticked, so there is no empty-purchase case to handle.

The amount field is text and not number — a number input refuses a comma in
some locales and silently empties itself. Confirming it empty is how you skip;
two buttons that both close the shop is one more decision than the moment
deserves.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The history

**Files:**

- Create: `app/(app)/spesa/storico/page.tsx`, `loading.tsx`, `error.tsx`, `actions.ts`
- Create: `app/(app)/spesa/storico/[id]/page.tsx`, `loading.tsx`
- Create: `components/shopping/purchase-total-form.tsx`

**Interfaces:**

- Consumes: `listPurchases`, `getPurchase`, `setPurchaseTotal` from Task 4; `formatEuro` from Task 2; `groupByAisle` from Task 4 Step 1; `EuroCentsSchema`, `PurchaseIdSchema` from Task 2.

A note before the code: `spesa/storico` is a static segment beside the dynamic `spesa/[weekStart]`. Next prefers the static one, so no configuration is needed — and even if it did not, `WeekStartSchema` rejects `storico` and the week page answers `notFound()`.

- [ ] **Step 1: The list**

`app/(app)/spesa/storico/page.tsx`:

```tsx
import Link from "next/link"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { APP_TIMEZONE } from "@/lib/config"
import { formatEuro } from "@/lib/money"
import { listPurchases } from "@/lib/services/purchases"

export const metadata = { title: "Storico spesa" }

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

const weekFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

function announce(count: number) {
  if (count === 0) return "Nessuna spesa registrata."
  return count === 1 ? "1 spesa registrata." : `${count} spese registrate.`
}

export default async function PurchaseHistoryPage() {
  const purchases = await listPurchases()

  return (
    <main className="flex flex-col gap-4 pt-6">
      <PageHeader title="Storico spesa" />

      <DataList
        items={purchases}
        announcement={announce(purchases.length)}
        renderItem={(purchase) => (
          <DataListRow
            key={purchase.id}
            href={`/spesa/storico/${purchase.id}`}
            title={dayFormat.format(purchase.purchasedAt)}
          >
            {purchase.totalCents === null ? (
              <Badge variant="secondary">totale da inserire</Badge>
            ) : (
              <span className="tabular-nums">
                {formatEuro(purchase.totalCents)}
              </span>
            )}
            <span>
              {purchase.itemCount === 1
                ? "1 articolo"
                : `${purchase.itemCount} articoli`}
            </span>
            <span>settimana del {weekFormat.format(purchase.weekStart)}</span>
          </DataListRow>
        )}
        empty={
          <EmptyState
            title="Nessuna spesa registrata."
            description="Quando spunti gli articoli e premi «Spesa completata», la spesa finisce qui."
          />
        }
      />
    </main>
  )
}
```

`loading.tsx` delegates to `ListSkeleton` with the label `"Caricamento dello storico…"`; `error.tsx` delegates to `PageError`, copied verbatim from `app/(app)/spesa/[weekStart]/error.tsx`.

- [ ] **Step 2: The total, editable**

`app/(app)/spesa/storico/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { EuroCentsSchema, PurchaseIdSchema } from "@/lib/schemas/shopping"
import { setPurchaseTotal } from "@/lib/services/purchases"
import type { TotalState } from "@/components/shopping/purchase-total-form"

export async function saveTotal(
  _state: TotalState,
  formData: FormData
): Promise<TotalState> {
  const id = PurchaseIdSchema.safeParse(formData.get("id"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  if (!id.success) return { message: "Questa spesa non è valida." }
  if (!total.success) return { message: total.error.issues[0].message }

  await requireSession()

  await setPurchaseTotal(id.data, total.data)

  revalidatePath("/spesa/storico")
  revalidatePath(`/spesa/storico/${id.data}`)
  return { message: null }
}
```

`components/shopping/purchase-total-form.tsx`:

```tsx
"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAttempt } from "@/hooks/use-attempt"

export type TotalState = { message: string | null }

export type SaveTotalAction = (
  state: TotalState,
  formData: FormData
) => Promise<TotalState>

const EMPTY: TotalState = { message: null }

export function PurchaseTotalForm({
  id,
  // Already formatted for editing — "12,34", not "12,34 €" — because this is a
  // field and not a reading.
  total,
  action,
}: {
  id: string
  total: string
  action: SaveTotalAction
}) {
  const [state, formAction, isPending] = useActionState(action, EMPTY)
  const attempt = useAttempt(state)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <Field key={attempt}>
        <FieldLabel htmlFor="total">Quanto hai pagato</FieldLabel>
        <Input
          id="total"
          name="total"
          type="text"
          inputMode="decimal"
          placeholder="12,34"
          defaultValue={total}
          autoComplete="off"
          aria-describedby="total-description"
        />
        <FieldDescription id="total-description">
          Svuota il campo per togliere l’importo.
        </FieldDescription>
      </Field>

      {state.message === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Salvo…" : "Salva l’importo"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: The detail**

`app/(app)/spesa/storico/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"

import { saveTotal } from "@/app/(app)/spesa/storico/actions"
import { PageHeader } from "@/components/page/page-header"
import { PurchaseTotalForm } from "@/components/shopping/purchase-total-form"
import { APP_TIMEZONE } from "@/lib/config"
import { formatEuro } from "@/lib/money"
import { PurchaseIdSchema } from "@/lib/schemas/shopping"
import { getPurchase } from "@/lib/services/purchases"
import { groupByAisle } from "@/lib/services/shopping-view"
import { amountOf } from "@/lib/units"

export const metadata = { title: "Spesa" }

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: raw } = await params
  const parsed = PurchaseIdSchema.safeParse(raw)

  // An id that is not an id is not a purchase that exists — not an error to
  // report.
  if (!parsed.success) notFound()

  const purchase = await getPurchase(parsed.data)
  if (purchase === null) notFound()

  const groups = groupByAisle(purchase.lines)

  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title={dayFormat.format(purchase.purchasedAt)}
        back={{ href: "/spesa/storico", label: "Storico spesa" }}
      />

      <p className="text-sm text-muted-foreground">
        {purchase.totalCents === null
          ? "Importo non ancora inserito."
          : formatEuro(purchase.totalCents)}
      </p>

      <PurchaseTotalForm
        id={purchase.id}
        total={
          purchase.totalCents === null
            ? ""
            : (purchase.totalCents / 100).toFixed(2).replace(".", ",")
        }
        action={saveTotal}
      />

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.aisle} className="flex flex-col gap-1">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.aisle}
            </h2>
            <ul className="flex flex-col">
              {group.lines.map((line) => {
                const amount = amountOf(line.quantity, line.unit)
                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-baseline gap-x-2 py-1 text-sm"
                  >
                    <span className="break-words">{line.name}</span>
                    {amount === null ? null : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {amount}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
```

`loading.tsx` delegates to `DetailSkeleton` with the label `"Caricamento della spesa…"`.

The aisle headings are the same markup as the shopping list's. Two screens sharing five lines of JSX is not yet a component; if a third wants it, extract then.

- [ ] **Step 4: Run the gate, the design skill, and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Run `web-design-guidelines` over the two pages and `purchase-total-form.tsx`.

```bash
git add app components
git commit -m "feat: /spesa/storico, every trip and what it cost

The history crosses the weeks on purpose: seeing the spend is the point, and a
history paged by week could not show it. A purchase with no amount says so in a
badge rather than showing a blank, because a blank reads as free.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The nav, the checklist, the roadmap

**Files:**

- Modify: `components/app-nav.tsx`, `docs/roadmap.md`

- [ ] **Step 1: The nav entry**

In `NAV_ITEMS`, after «Spesa»:

```ts
  { href: "/spesa/storico", label: "Storico spesa" },
```

«Storico spesa» and not «Storico»: personal finance is a planned module and will want a history of its own, and two entries called «Storico» in one menu is a bug waiting to be filed.

Check `aria-current` still lands right — `/spesa/storico` starts with `/spesa`, so a nav that highlights on a prefix would light both entries. If it does, tighten the comparison to an exact match plus a segment boundary.

- [ ] **Step 2: Walk the checklist at 390px**

Reuse the running `pnpm dev`. Every point is pass or fail; a fail is fixed before the plan closes.

1. `/spesa/<current week>` with nothing ticked: **no bar at the foot**.
2. Tick one line: the bar appears reading «Spesa completata (1)». Its count matches.
3. Tick four more: the count reaches 5 within one refresh.
4. Scroll the list: the bar stays put and never covers the last line.
5. Tap it: the drawer opens, the description says how many articles move.
6. Type `abc`, confirm: refused, in Italian, the drawer stays open, nothing is lost.
7. Type `1.234,56`, confirm: refused with the message about the thousands separator.
8. Type `12,34`, confirm: the drawer closes, the ticked lines are gone from the list, the bar is gone.
9. `/spesa/storico` shows one purchase: today's date, `12,34 €`, the article count, the week.
10. Open it: the lines are grouped by aisle in walking order, with quantities and units.
11. Change the amount to `15`, save: the list shows `15,00 €`.
12. Empty the field, save: the detail says «Importo non ancora inserito.» and the list shows the «totale da inserire» badge.
13. Back on the week: press «Rigenera». **The lines you bought do not come back.** This is the point of Task 3.
14. Change a menu slot so one bought ingredient is needed in a larger quantity, regenerate: **the line comes back with the difference only**.
15. Tick two lines, close a second shop with no amount: two purchases in the history, the newest first.
16. The nav reads Menù · Spesa · Storico spesa · Ricettario · Catalogo, and only one entry carries `aria-current` at a time.
17. `/spesa/storico/not-an-id` answers the 404 page.

- [ ] **Step 3: Update the roadmap**

Add a row to Shipped:

```markdown
| [`2026-08-18-shopping-done`](superpowers/plans/2026-08-18-shopping-done.md) | `Purchase` and `PurchaseItem`, the bar at the till, `/spesa/storico`, and the aggregator subtracting what has already been bought |
```

Update `Last updated:`, and record under the standing decisions:

> **What has been bought is subtracted, not forgotten — 2026-08-18.** `aggregateShoppingList` takes a required `purchased` input. Making it optional would let a caller silently regenerate as if nothing had ever been bought, which is the exact defect the rule exists to prevent.

Under "Parked defects", add the one §15 of the design left deliberately open, so it is a decision on the record rather than an oversight:

| Defect                                                                                                                                                                                                                                                              | Where                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| A purchase cannot be deleted or undone. Closing a shop by mistake is recoverable only through the database. **Deliberate**: not requested, and an undo has to decide what to do when the list has been regenerated since. Add it the first time it actually happens | `lib/services/purchases.ts` |

- [ ] **Step 4: Commit and finish the branch**

```bash
git add components docs
git commit -m "docs: record the purchase history as shipped

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

Then `superpowers:finishing-a-development-branch`, for the whole branch and all three plans at once. One PR, squash-merged, branch deleted.
