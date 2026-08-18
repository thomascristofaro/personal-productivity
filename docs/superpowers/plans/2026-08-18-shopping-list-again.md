# Shopping List Revision Implementation Plan (B of three)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the list say what each line is for and when it is needed, stop showing the same thing twice, and move adding a line into a drawer that accepts anything — shampoo included.

**Architecture:** Two pure functions carry the work. `aggregateShoppingList` learns which days a line comes from. A new `mergeLines` unites rows with the same name and unit **when the list is read**, so the rows stay apart in the database and regeneration — which deletes generated rows and rebuilds them — needs to know nothing about the rule. The screen follows: the `+` moves to the header and opens a drawer, and a name the catalogue does not hold is created in it unless the user says not to.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`maia` / `olive` / `lime`).

**Spec:** `docs/superpowers/specs/2026-08-18-catalogue-and-purchases-design.md` — §5 (days), §6 (the merge and every one of its rules), §7 (the drawer), §13 (testing), §14 (the defect Task 1 chases).

**This is plan B of three.** It is cut from `main` **after plan A has merged**: everything here names `CatalogItem`, `lib/services/catalog.ts` and `lib/schemas/catalog.ts`. Plan C is cut after this one.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited by this plan.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; add `nativeButton={false}` when `render` yields a non-button.
- **Use the page primitives.** `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton` in `components/page/`. Do not rebuild them and do not add a boolean prop to one.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth` — `lib/config`, `lib/week`, `lib/units` and `lib/aisles` are leaf modules and are allowed. `lib/schemas/**` imports Zod and its own siblings, nothing else. ESLint fails the build.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **`actorId` is reserved.** It comes from `requireSession()`, never from a form field.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws`. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads.** English for identifiers, comments, TSDoc, file names, commit messages.
- **Schema changes go through a migration.** Never edit the database by hand.
- **Phone first at 390px.** Theme tokens only, no hex, no raw palette classes. A fixed element at the foot needs `env(safe-area-inset-bottom)`.
- **`pnpm verify` is the gate.**

## Testing

Per `docs/conventions/testing.md`: Zod schemas and pure functions are tested; React components are not — `vitest.config.ts` runs `environment: "node"` with no DOM. The two pure modules this plan touches are where the risk is, and they get the tests. Component tasks verify with `pnpm verify` plus the written browser check in Task 8.

## The shell

If a command fails with `"node" non è riconosciuto`, the Git Bash `PATH` carries a broken `app.asar` entry. Run `pnpm` through PowerShell, stripping it in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

`git commit` does not need it. Never `--no-verify`. The owner runs `pnpm dev` on port 3000 — reuse it, a second one refuses to start.

---

## File Structure

**Created**

| File                                                      | Responsibility                                      |
| --------------------------------------------------------- | --------------------------------------------------- |
| `prisma/migrations/<ts>_shopping_item_days/migration.sql` | the `days` column                                   |
| `lib/services/shopping-view.ts`                           | `mergeLines` and `groupByAisle` — pure, no database |
| `lib/services/shopping-view.test.ts`                      | covers both                                         |
| `components/shopping/add-item-drawer.tsx`                 | the `+`, its drawer and its form                    |

**Deleted**

`components/shopping/add-item-form.tsx`, replaced by the drawer.

**Modified**

| File                                        | Change                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| `prisma/schema.prisma`                      | `ShoppingListItem.days Int[]`                                  |
| `lib/week.ts`                               | `dayLabels(weekStart)`                                         |
| `lib/week.test.ts`                          | covers it                                                      |
| `lib/services/shopping-aggregate.ts`        | `day` in, `days` out                                           |
| `lib/services/shopping-aggregate.test.ts`   | two fixture builders gain a field; three cases added           |
| `lib/services/shopping-lists.ts`            | `days` selected and written; `groupByAisle` leaves; ids plural |
| `lib/services/shopping-lists.test.ts`       | the `groupByAisle` block moves out                             |
| `lib/schemas/shopping.ts`                   | `ShoppingItemIdsSchema`, `AddShoppingItemSchema`               |
| `lib/schemas/shopping.test.ts`              | covers them                                                    |
| `components/shopping/shopping-item-row.tsx` | one merged line, its days, its several ids                     |
| `components/shopping/shopping-list.tsx`     | passes the day labels through                                  |
| `app/(app)/spesa/[weekStart]/page.tsx`      | merges before grouping; the `+` in the header                  |
| `app/(app)/spesa/[weekStart]/actions.ts`    | `addItem` becomes a `useActionState` action; ids plural        |
| `app/(app)/menu/[weekStart]/page.tsx`       | uses `dayLabels`                                               |
| `docs/roadmap.md`                           | a row in Shipped                                               |

---

## Task 1: Why a hand-added line shows no quantity

**REQUIRED SUB-SKILL: `superpowers:systematic-debugging`.** The defect is reported and real; reading the code does not account for it. Task 7 replaces the form that has it, so this has to be understood _before_ the rewrite, or the rewrite either carries the cause forward or hides it — and neither is knowing.

**Files:** whatever the diagnosis names. Possibly none.

- [ ] **Step 1: Reproduce it**

At 390px, on `/spesa/<the current week>`, with a list already generated: fill the form at the foot with name `sacchetti`, quantity `3`, unit empty, reparto `casa e pulizia`. Submit. Record exactly what the new row renders.

- [ ] **Step 2: Bisect the path**

The value crosses four boundaries. Find the first one it does not survive, rather than guessing:

1. **The DOM** — before submitting, in the console: `document.querySelector('#quantity').value`.
2. **The action** — temporarily `console.log(formData.get("quantity"))` at the top of `addItem` in `app/(app)/spesa/[weekStart]/actions.ts`. Server logs land in the `pnpm dev` terminal.
3. **The schema** — log `input.success` and `input.error?.issues` in the same place.
4. **The row** — `pnpm db:studio`, table `ShoppingListItem`, newest row, column `quantity`.

- [ ] **Step 3: Write down the finding**

One paragraph, in this task, saying which boundary lost it and why. If the answer is that the value was never typed — the form is below the fold and the field is easy to miss — that is a finding too, and Task 7's drawer is the fix.

- [ ] **Step 4: Fix it, or record that Task 7 does**

If the cause is in code that Task 7 deletes, do not patch it: note it here and add a case to Task 7's browser checklist that would catch it again. If the cause is in code that survives — the action, the schema, the service, the row — fix it now, with a test if the broken thing is pure.

- [ ] **Step 5: Remove the logging, run the gate, commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Commit only if Step 4 changed a file. A commit whose only content is a finding belongs in this plan document instead.

---

## Task 2: `dayLabels`, in one place

**Files:**

- Modify: `lib/week.ts`, `lib/week.test.ts`
- Modify: `app/(app)/menu/[weekStart]/page.tsx:19-21,49`

**Interfaces:**

- Consumes: `APP_TIMEZONE`, `DAYS_IN_WEEK` from `lib/config`, already imported there.
- Produces: `export function dayLabels(weekStart: Date): string[]` — seven short Italian labels, Monday first.

- [ ] **Step 1: Write the failing test**

Append to `lib/week.test.ts`, importing `dayLabels`:

```ts
describe("dayLabels", () => {
  const monday = new Date("2026-08-10T00:00:00.000Z")

  it("returns one label per day of the week", () => {
    expect(dayLabels(monday)).toHaveLength(7)
  })

  it("starts on Monday and ends on Sunday", () => {
    const labels = dayLabels(monday)
    expect(labels[0].toLowerCase()).toContain("lun")
    expect(labels[6].toLowerCase()).toContain("dom")
  })

  it("is the same seven labels whichever week is asked for", () => {
    expect(dayLabels(new Date("2026-01-05T00:00:00.000Z"))).toEqual(
      dayLabels(monday)
    )
  })
})
```

The third case is the one that matters: two screens must not disagree about what Monday is called.

- [ ] **Step 2: Run it and watch it fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/week.test.ts
```

Expected: FAIL — `dayLabels` is not exported.

- [ ] **Step 3: Implement it**

Append to `lib/week.ts`:

```ts
const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
})

/**
 * The seven short day names of a week, Monday first.
 *
 * Takes a week rather than nothing because the formatter is timezone-aware and
 * a `Date` is what it wants; every week produces the same seven strings. Both
 * the menu grid and the shopping list render these, and two screens disagreeing
 * about what Monday is called is the reason this is one function.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns Seven labels, index 0 Monday through index 6 Sunday.
 */
export function dayLabels(weekStart: Date): string[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    dayFormat.format(dateForDay(weekStart, day))
  )
}
```

- [ ] **Step 4: Run it and watch it pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/week.test.ts
```

Expected: PASS.

- [ ] **Step 5: Use it in the menu page**

In `app/(app)/menu/[weekStart]/page.tsx`, delete the local `dayFormat` const and replace the inline construction at line 49 with `const labels = dayLabels(weekStart)`, passing `dayLabels={labels}` to `WeekGrid`. The prop keeps its name.

- [ ] **Step 6: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add lib/week.ts lib/week.test.ts app/\(app\)/menu
git commit -m "refactor: the seven day labels come from lib/week.ts

The menu grid built them inline and the shopping list is about to want the same
seven strings. Two screens disagreeing about what Monday is called is the reason
this is one function rather than two formatters.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: A line knows which days it is for

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_shopping_item_days/migration.sql` (generated, not hand-written this time)
- Modify: `lib/services/shopping-aggregate.ts`, `lib/services/shopping-aggregate.test.ts`
- Modify: `lib/services/shopping-lists.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `AggregatorSlot` gains `day: number`; `ShoppingItem` and `StoredItem` gain `days: number[]`.

- [ ] **Step 1: Add the column**

In `prisma/schema.prisma`, in `model ShoppingListItem`, after `aisle`:

```prisma
  // Which days of the week the line is needed for, 0 Monday through 6 Sunday.
  // Empty for a line added by hand: it answers to nobody's menu.
  days        Int[]
```

Then:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:migrate --name shopping_item_days
pnpm db:generate
```

This one is generated and applied normally — a Postgres scalar list is `NOT NULL DEFAULT ARRAY[]`, so existing rows take an empty array and nothing is lost. Read the SQL before letting it run all the same.

- [ ] **Step 2: Write the failing tests**

In `lib/services/shopping-aggregate.test.ts`, extend the two fixture builders. `slot` gains a day, defaulting to Monday so every existing case keeps compiling:

```ts
const slot = (
  ingredients: IngredientFixture[],
  options: {
    recipeServings?: number | null
    slotServings?: number | null
    day?: number
  } = {}
): AggregatorSlot => ({
  day: options.day ?? 0,
  servings: options.slotServings ?? null,
  recipe: { … unchanged … },
})
```

and `item` gains `days: []` among its defaults, before the spread.

Then a new describe block:

```ts
describe("the days a line is needed for", () => {
  it("carries the day of the slot that asked for it", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 2 }),
    ])

    expect(result[0].days).toEqual([2])
  })

  it("collects every day, in order, when several slots ask for the same thing", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 4 }),
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }], { day: 1 }),
    ])

    expect(result[0].days).toEqual([1, 4])
  })

  it("lists a day once, however many meals of it ask", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 3 }),
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }], { day: 3 }),
    ])

    expect(result[0].days).toEqual([3])
  })

  it("leaves a line added by hand with no days, because no menu asked for it", () => {
    const result = aggregate(
      [],
      [item({ name: "sacchetti", manual: true, aisle: AISLE_UNKNOWN })]
    )

    expect(result[0].days).toEqual([])
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-aggregate.test.ts
```

Expected: FAIL — `days` is undefined on the result, and `tsc` will also object to `day` on `AggregatorSlot`.

- [ ] **Step 4: Implement it**

In `lib/services/shopping-aggregate.ts`:

```ts
export type AggregatorSlot = {
  // 0 Monday through 6 Sunday. The line the slot contributes to says so.
  day: number
  servings: number | null
  recipe: { … unchanged … } | null
}

export type ShoppingItem = {
  … unchanged …
  days: number[]
}

type Total = {
  name: string
  aisle: string
  unit: string | null
  quantity: number | null
  days: number[]
}
```

In `totalsFor`, every place that writes into `totals` records the day. Add a helper above the loop:

```ts
// Mutates in place: the map's value is this function's own object and never
// escapes until the map is spread.
const noteDay = (total: Total, day: number) => {
  if (!total.days.includes(day)) total.days.push(day)
  return total
}
```

The unquantified branch becomes:

```ts
if (ingredient.quantity === null) {
  if (current === undefined) {
    totals.set(key, {
      name: ingredient.name,
      aisle: ingredient.aisle,
      unit: null,
      quantity: null,
      days: [slot.day],
    })
  } else {
    noteDay(current, slot.day)
  }
  continue
}
```

and the quantified one:

```ts
totals.set(
  key,
  noteDay(
    {
      name: ingredient.name,
      aisle: ingredient.aisle,
      unit,
      quantity: (current?.quantity ?? 0) + ingredient.quantity * factor,
      days: current?.days ?? [],
    },
    slot.day
  )
)
```

In `aggregateShoppingList`, the generated item gains `days: [...total.days].sort((a, b) => a - b)`. The `previous` map does not carry days across: they are recomputed from the menu every time, which is the point.

- [ ] **Step 5: Run them and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-aggregate.test.ts
```

Expected: PASS — the four new cases and all seventeen that were already there.

- [ ] **Step 6: Load and store the column**

In `lib/services/shopping-lists.ts`:

- `itemFields` gains `days: true`.
- `regenerateShoppingList`'s `select` gains `day: true` inside `slots`, and the mapping gains `day: slot.day`.
- `addManualItem` writes `days: []`.

`createMany` already spreads the aggregator's output, so `days` reaches the row with no further change.

- [ ] **Step 7: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add prisma lib/services/shopping-aggregate.ts lib/services/shopping-aggregate.test.ts lib/services/shopping-lists.ts
git commit -m "feat: a shopping line records which days it is needed for

The aggregator already reads every slot; it now keeps the day each one
contributed. A day is listed once however many of its meals ask, and a line
added by hand carries none — no menu asked for it.

Days are recomputed on every regeneration rather than carried across like the
ticks are: they are a fact about the current menu, not about the shopper.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: The merge, in the read path

The heart of the plan. Everything here is pure and has no database, which is why it gets the tests and the screen does not.

**Files:**

- Create: `lib/services/shopping-view.ts`, `lib/services/shopping-view.test.ts`
- Modify: `lib/services/shopping-lists.ts` — `groupByAisle` leaves
- Modify: `lib/services/shopping-lists.test.ts` — its `groupByAisle` block leaves with it

**Interfaces:**

- Consumes: `aisleRank` from `lib/aisles`; `StoredItem` from `lib/services/shopping-lists`.
- Produces:

```ts
export type MergedLine = {
  key: string
  ids: string[]
  manualIds: string[]
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  days: number[]
  checked: boolean
}
export type AisleGroup = { aisle: string; lines: MergedLine[] }

export function mergeLines(items: StoredItem[]): MergedLine[]
export function groupByAisle(lines: MergedLine[]): AisleGroup[]
```

Note `AisleGroup.lines`, not `items`: the field is renamed with the type it carries, so nothing silently keeps compiling against the old shape.

- [ ] **Step 1: Write the failing tests**

`lib/services/shopping-view.test.ts`, in full:

```ts
import { describe, expect, it } from "vitest"

import { groupByAisle, mergeLines } from "@/lib/services/shopping-view"
import type { StoredItem } from "@/lib/services/shopping-lists"

let next = 0
const item = (over: Partial<StoredItem>): StoredItem => ({
  id: `id-${++next}`,
  name: "pomodori",
  quantity: null,
  unit: null,
  aisle: "ortofrutta",
  checked: false,
  checkedById: null,
  checkedAt: null,
  manual: false,
  days: [],
  ...over,
})

describe("mergeLines", () => {
  it("returns nothing for an empty list", () => {
    expect(mergeLines([])).toEqual([])
  })

  it("leaves two different things alone", () => {
    const lines = mergeLines([
      item({ name: "pomodori" }),
      item({ name: "mele" }),
    ])

    expect(lines).toHaveLength(2)
  })

  it("sums the quantities of one name and one unit", () => {
    const lines = mergeLines([
      item({ quantity: 300, unit: "g" }),
      item({ quantity: 200, unit: "g", manual: true }),
    ])

    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(500)
  })

  it("keeps two units apart, because 2 spicchi and 200 g are not one line", () => {
    const lines = mergeLines([
      item({ name: "aglio fresco", quantity: 2, unit: "spicchio" }),
      item({ name: "aglio fresco", quantity: 200, unit: "g" }),
    ])

    expect(lines).toHaveLength(2)
  })

  it("keeps a null unit apart from a named one", () => {
    const lines = mergeLines([
      item({ quantity: 2, unit: null }),
      item({ quantity: 200, unit: "g" }),
    ])

    expect(lines).toHaveLength(2)
  })

  it("stays unquantified when every row is", () => {
    const lines = mergeLines([
      item({ quantity: null }),
      item({ quantity: null }),
    ])

    expect(lines[0].quantity).toBeNull()
  })

  it("sums the quantified rows and ignores the unquantified one", () => {
    const lines = mergeLines([
      item({ quantity: null }),
      item({ quantity: 200, unit: null }),
    ])

    // Different units — null against null — so these are one line, and "olio
    // q.b." plus 200 ml is 200 ml, not nothing.
    expect(lines.find((line) => line.quantity !== null)?.quantity).toBe(200)
  })

  it("loses the floating-point noise a sum introduces", () => {
    const lines = mergeLines([
      item({ quantity: 0.1, unit: "l" }),
      item({ quantity: 0.2, unit: "l" }),
    ])

    expect(lines[0].quantity).toBe(0.3)
  })

  it("holds every id behind the line, so ticking it ticks them all", () => {
    const lines = mergeLines([
      item({ id: "a", quantity: 300, unit: "g" }),
      item({ id: "b", quantity: 200, unit: "g" }),
    ])

    expect(lines[0].ids).toEqual(["a", "b"])
  })

  it("is ticked only when every row behind it is", () => {
    const lines = mergeLines([
      item({ quantity: 300, unit: "g", checked: true }),
      item({ quantity: 200, unit: "g", checked: false }),
    ])

    expect(lines[0].checked).toBe(false)
  })

  it("is ticked when they all are", () => {
    const lines = mergeLines([
      item({ quantity: 300, unit: "g", checked: true }),
      item({ quantity: 200, unit: "g", checked: true }),
    ])

    expect(lines[0].checked).toBe(true)
  })

  it("names only the rows added by hand, so the bin removes only those", () => {
    const lines = mergeLines([
      item({ id: "generated", quantity: 300, unit: "g" }),
      item({ id: "byhand", quantity: 200, unit: "g", manual: true }),
    ])

    expect(lines[0].manualIds).toEqual(["byhand"])
  })

  it("names no manual rows when the menu produced all of them", () => {
    const lines = mergeLines([item({ quantity: 300, unit: "g" })])

    expect(lines[0].manualIds).toEqual([])
  })

  it("unites the days, in order, without repeating one", () => {
    const lines = mergeLines([
      item({ quantity: 300, unit: "g", days: [4, 1] }),
      item({ quantity: 200, unit: "g", days: [1, 2] }),
    ])

    expect(lines[0].days).toEqual([1, 2, 4])
  })

  it("takes the earliest aisle in walking order when two rows disagree", () => {
    const lines = mergeLines([
      item({ quantity: 1, unit: null, aisle: "dispensa" }),
      item({ quantity: 1, unit: null, aisle: "ortofrutta" }),
    ])

    expect(lines[0].aisle).toBe("ortofrutta")
  })

  it("gives one line one stable key, whatever the row ids are", () => {
    const first = mergeLines([item({ id: "a", quantity: 1, unit: "g" })])
    const second = mergeLines([item({ id: "b", quantity: 9, unit: "g" })])

    expect(first[0].key).toBe(second[0].key)
  })

  it("cannot be tricked into one line by a name containing the separator", () => {
    const lines = mergeLines([
      item({ name: 'pomodori","g' }),
      item({ name: "pomodori", unit: "g" }),
    ])

    expect(lines).toHaveLength(2)
  })
})

const line = (over: Partial<StoredItem>) => mergeLines([item(over)])[0]

describe("groupByAisle", () => {
  it("returns nothing for an empty list", () => {
    expect(groupByAisle([])).toEqual([])
  })

  it("puts the aisles in walking order, not alphabetical order", () => {
    const groups = groupByAisle([
      line({ name: "latte", aisle: "banco frigo" }),
      line({ name: "mele", aisle: "ortofrutta" }),
    ])

    expect(groups.map((group) => group.aisle)).toEqual([
      "ortofrutta",
      "banco frigo",
    ])
  })

  it("keeps the catch-all last, whatever its name would sort as", () => {
    const groups = groupByAisle([
      line({ name: "sacchetti", aisle: "altro" }),
      line({ name: "vino", aisle: "bevande" }),
    ])

    expect(groups[groups.length - 1].aisle).toBe("altro")
  })

  it("gathers every line of one aisle into a single group", () => {
    const groups = groupByAisle([
      line({ name: "mele", aisle: "ortofrutta" }),
      line({ name: "latte", aisle: "banco frigo" }),
      line({ name: "pere", aisle: "ortofrutta" }),
    ])

    expect(groups[0].lines.map((entry) => entry.name)).toEqual(["mele", "pere"])
  })

  it("folds an aisle nobody recognises in with the catch-all", () => {
    const groups = groupByAisle([
      line({ name: "sacchetti", aisle: "altro" }),
      line({ name: "shampoo", aisle: "ortofruta" }),
    ])

    expect(groups).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-view.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement it**

`lib/services/shopping-view.ts`, in full:

```ts
import { aisleRank } from "@/lib/aisles"
import type { StoredItem } from "@/lib/services/shopping-lists"

/** One line as the screen shows it: several stored rows seen as one thing. */
export type MergedLine = {
  // Derived from the name and the unit, so it is stable across renders and
  // across a regeneration that gave every row a new id.
  key: string
  ids: string[]
  // The subset added by hand. The bin removes these and leaves the rest, so
  // deleting your own 200 g does not remove what the menu still needs.
  manualIds: string[]
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  days: number[]
  checked: boolean
}

export type AisleGroup = { aisle: string; lines: MergedLine[] }

// JSON rather than string concatenation, so a name containing the separator
// cannot forge another line's key, and a null unit stays distinct from "".
// The same encoding the aggregator keys on, for the same reason.
const lineKey = (name: string, unit: string | null) =>
  JSON.stringify([name, unit])

/**
 * Unites the rows that stand for one thing into the lines the screen shows.
 *
 * The database deliberately keeps them apart: a regeneration deletes the
 * generated rows and rebuilds them, and a hand-added 200 g of tomatoes must
 * survive that. Merging here rather than on the way in is what lets both be
 * true — see design document section 6, which fixes every rule below.
 *
 * Pure: no database, no state, and stable for a given input.
 *
 * @param items Every row of the list, in any order.
 * @returns One line per name and unit, in the order the names first appeared.
 */
export function mergeLines(items: StoredItem[]): MergedLine[] {
  const lines = new Map<string, MergedLine>()

  for (const row of items) {
    const key = lineKey(row.name, row.unit)
    const line = lines.get(key)

    if (line === undefined) {
      lines.set(key, {
        key,
        ids: [row.id],
        manualIds: row.manual ? [row.id] : [],
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        aisle: row.aisle,
        days: [...row.days],
        checked: row.checked,
      })
      continue
    }

    line.ids.push(row.id)
    if (row.manual) line.manualIds.push(row.id)
    if (row.quantity !== null) {
      line.quantity = (line.quantity ?? 0) + row.quantity
    }
    for (const day of row.days) {
      if (!line.days.includes(day)) line.days.push(day)
    }
    // A tick means "I have this". Half of it ticked means the line is not done.
    line.checked = line.checked && row.checked
    // Two rows for one name should agree, and in every real case do. When they
    // do not, the earlier aisle wins: finding a thing too early in the shop
    // costs a moment, finding it too late costs the walk back.
    if (aisleRank(row.aisle) < aisleRank(line.aisle)) line.aisle = row.aisle
  }

  return [...lines.values()].map((line) => ({
    ...line,
    days: [...line.days].sort((a, b) => a - b),
    // Summing floats introduces noise the shopper should never read:
    // 0.1 + 0.2 is 0.30000000000000004.
    quantity:
      line.quantity === null ? null : Math.round(line.quantity * 100) / 100,
  }))
}

/**
 * Gathers the lines into the aisles of the supermarket walking order.
 *
 * Sorts as well as groups, because the rows arrive from Postgres in whatever
 * order it liked and no SQL `ORDER BY` can express a walking order that is not
 * alphabetical. Moved here from shopping-lists.ts when that file grew to two
 * jobs; it now takes merged lines rather than stored rows.
 *
 * @param lines Every line of the list, merged.
 * @returns One group per aisle that has lines, in walking order, each group's
 *   lines by name.
 */
export function groupByAisle(lines: MergedLine[]): AisleGroup[] {
  const sorted = [...lines].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )

  const groups: AisleGroup[] = []

  for (const line of sorted) {
    const last = groups[groups.length - 1]
    // Adjacency is enough because the sort already put one aisle's lines
    // together, and it keeps an unrecognised aisle folded in with the catch-all
    // exactly the way aisleRank ranks it.
    if (last !== undefined && aisleRank(last.aisle) === aisleRank(line.aisle)) {
      last.lines.push(line)
      continue
    }
    groups.push({ aisle: line.aisle, lines: [line] })
  }

  return groups
}
```

- [ ] **Step 4: Run them and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/shopping-view.test.ts
```

Expected: PASS, 22 cases.

- [ ] **Step 5: Take `groupByAisle` out of `shopping-lists.ts`**

Delete `groupByAisle` and the `AisleGroup` type from `lib/services/shopping-lists.ts`, and delete the whole `describe("groupByAisle")` block from `lib/services/shopping-lists.test.ts` — it now lives in `shopping-view.test.ts` in its merged-line form. If nothing is left in `shopping-lists.test.ts`, delete the file: `isListStale` is tested in `menus.test.ts`, which is where it lives.

`app/(app)/spesa/[weekStart]/page.tsx` imports `groupByAisle` from the old module. Leave it broken until Task 6 — or, if a red `tsc` between tasks is intolerable, change the import now and add `mergeLines` around it in the same edit; Task 6 then only changes the rendering.

- [ ] **Step 6: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

```bash
git add lib/services app/\(app\)/spesa
git commit -m "feat: rows for one thing become one line when the list is read

Summing into the existing row was the obvious implementation and loses the
hand-added quantity at the next regeneration, which rebuilds every generated
row from the menu. So the rows stay apart in the database and the merge happens
in the read path: regeneration keeps working exactly as it did and needs to
know nothing about the rule.

A line is ticked only when every row behind it is, and the bin removes only the
rows added by hand — deleting your own 200 g must not remove what the menu
still needs.

groupByAisle moves with it. shopping-lists.ts was three hundred lines doing two
jobs: talking to the database, and shaping a list for a screen.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: One line, several ids

**Files:**

- Modify: `lib/schemas/shopping.ts`, `lib/schemas/shopping.test.ts`
- Modify: `lib/services/shopping-lists.ts`
- Modify: `app/(app)/spesa/[weekStart]/actions.ts`

**Interfaces:**

- Consumes: `ShoppingItemIdSchema`, already there.
- Produces:
  - `ShoppingItemIdsSchema: ZodArray<…>` — at least one id, at most twenty
  - `setItemChecked(ids: string[], actorId: string, checked: boolean): Promise<void>`
  - `removeManualItems(ids: string[]): Promise<void>` — replaces `removeManualItem`

- [ ] **Step 1: Write the failing test**

Append to `lib/schemas/shopping.test.ts`:

```ts
describe("ShoppingItemIdsSchema", () => {
  const id = "cm3xk1p2h0000abcdefghijkl"

  it("takes the several ids one merged line stands for", () => {
    expect(ShoppingItemIdsSchema.parse([id, id])).toEqual([id, id])
  })

  it("refuses an empty list, which would tick nothing and report success", () => {
    expect(ShoppingItemIdsSchema.safeParse([]).success).toBe(false)
  })

  it("refuses anything that is not an id", () => {
    expect(ShoppingItemIdsSchema.safeParse(["1 OR 1=1"]).success).toBe(false)
  })

  it("caps the count, so a forged post cannot tick the whole list at once", () => {
    expect(
      ShoppingItemIdsSchema.safeParse(Array.from({ length: 21 }, () => id))
        .success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/schemas/shopping.test.ts
```

Expected: FAIL — `ShoppingItemIdsSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `lib/schemas/shopping.ts`, after `ShoppingItemIdSchema`:

```ts
// A merged line stands for every row behind it, so a tick posts several ids.
// Twenty is far above what one name and one unit can realistically produce and
// far below what a forged post would want.
export const ShoppingItemIdsSchema = z
  .array(ShoppingItemIdSchema)
  .min(1, "Questa riga non è valida.")
  .max(20, "Questa riga non è valida.")
```

- [ ] **Step 4: Run it and watch it pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/schemas/shopping.test.ts
```

Expected: PASS.

- [ ] **Step 5: Widen the service**

In `lib/services/shopping-lists.ts`:

```ts
/**
 * Ticks or unticks every row behind one line, recording who did it.
 *
 * A line the screen shows is several rows when the menu and a hand-added entry
 * both asked for the same thing, and half a line ticked is not a state the
 * shopper can express. Last-write-wins per row, which §8 of the original design
 * accepts at this scale: two people and a checkbox.
 *
 * @param ids Every row behind the line.
 * @param actorId The session's user id — never a value from the request body.
 * @param checked The new state.
 * @returns Nothing.
 * @throws NoListError When none of the rows is there any more.
 */
export async function setItemChecked(
  ids: string[],
  actorId: string,
  checked: boolean
): Promise<void> {
  const updated = await db.shoppingListItem.updateMany({
    where: { id: { in: ids } },
    data: {
      checked,
      checkedById: checked ? actorId : null,
      checkedAt: checked ? new Date() : null,
    },
  })

  if (updated.count === 0) throw new NoListError()
}
```

and

```ts
/**
 * Removes the rows of a line that were added by hand.
 *
 * Generated rows are not removable: the next regeneration would bring them
 * back, so the `where` refuses them rather than offering a button that lies.
 * A line that is part generated and part hand-added therefore survives with
 * only what the menu asks for, which is the point.
 *
 * @param ids The rows to remove.
 * @returns Nothing.
 */
export async function removeManualItems(ids: string[]): Promise<void> {
  await db.shoppingListItem.deleteMany({
    where: { id: { in: ids }, manual: true },
  })
}
```

Delete `removeManualItem`.

- [ ] **Step 6: Widen the actions**

In `app/(app)/spesa/[weekStart]/actions.ts`, `toggle` and `removeItem` read `getAll`:

```ts
export async function toggle(formData: FormData): Promise<void> {
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!ids.success || !weekStart.success) return

  // The identity comes from the session and never from the form: a client that
  // could name the ticker could tick as the other user.
  const session = await requireSession()

  try {
    await setItemChecked(
      ids.data,
      session.userId,
      formData.get("checked") === "1"
    )
  } catch (error) {
    // The rows went away under us — a regeneration between the render and the
    // tap. Re-rendering shows the list as it now is.
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}
```

`removeItem` the same, calling `removeManualItems(ids.data)`.

- [ ] **Step 7: Run the gate and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

`tsc` will point at `components/shopping/shopping-item-row.tsx`, which still posts one id. Task 6 fixes it; if a red gate between tasks is intolerable, do Steps 1-3 of Task 6 before committing this one.

```bash
git add lib/schemas lib/services app/\(app\)/spesa
git commit -m "feat: a tick reaches every row behind the line

A merged line stands for several rows, and half of it ticked is not a state the
shopper can express. The schema caps the count at twenty: far above what one
name and one unit can realistically produce, far below what a forged post
would want.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The row says what it is for

**Files:**

- Modify: `components/shopping/shopping-item-row.tsx`
- Modify: `components/shopping/shopping-list.tsx`
- Modify: `app/(app)/spesa/[weekStart]/page.tsx`

**Interfaces:**

- Consumes: `MergedLine`, `AisleGroup`, `mergeLines`, `groupByAisle` from Task 4; `dayLabels` from Task 2.
- Produces: `ShoppingItemRow` taking `line: MergedLine` and `dayLabels: string[]`.

`components/**` may not import `lib/services/**`, so the row cannot import `MergedLine`. It declares the shape it needs, exactly as it declares `ShoppingRow` today, and the page's call site is what checks the two agree.

- [ ] **Step 1: The row**

`components/shopping/shopping-item-row.tsx`, replacing `ShoppingRow` and the body:

```tsx
export type ShoppingRow = {
  key: string
  ids: string[]
  manualIds: string[]
  name: string
  quantity: number | null
  unit: string | null
  days: number[]
  checked: boolean
}

// Three fit on a 390px row beside a name and a quantity; a fourth wraps. The
// full list is still announced — see the sr-only span below.
const DAYS_SHOWN = 3

function daysText(days: number[], labels: string[]): string | null {
  if (days.length === 0) return null
  const named = days.map((day) => labels[day] ?? "?")
  if (named.length <= DAYS_SHOWN) return named.join(", ")
  return `${named.slice(0, 2).join(", ")} +${named.length - 2}`
}
```

and inside the component:

```tsx
const amount = amountOf(line.quantity, line.unit)
const short = daysText(line.days, dayLabels)
const full = line.days.map((day) => dayLabels[day] ?? "?").join(", ")
const inputId = `line-${line.key}`
```

The checkbox posts every id:

```tsx
        onCheckedChange={(next: boolean) => {
          const data = new FormData()
          for (const id of line.ids) data.append("id", id)
          data.set("checked", next ? "1" : "")

          startTransition(async () => {
            setChecked(next)
            await toggleAction(data)
          })
        }}
```

The label gains the days after the quantity:

```tsx
;<span className="break-words">{line.name}</span>
{
  amount === null ? null : (
    <span className="text-xs text-muted-foreground tabular-nums">{amount}</span>
  )
}
{
  short === null ? null : (
    <span className="text-xs text-muted-foreground">
      {/* "+2" is not a day. The abbreviation is for the eye and the full
                list for the screen reader, rather than one compromise for both. */}
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">serve {full}</span>
    </span>
  )
}
```

`id={inputId}` on the `Checkbox` and `htmlFor={inputId}` on the label: the row id is no longer one row's id, and a key derived from the name is what survives a regeneration renumbering everything.

The bin appears on `manualIds.length > 0` and posts those:

```tsx
{
  line.manualIds.length === 0 ? null : (
    <form action={removeAction}>
      {line.manualIds.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={
          line.manualIds.length === line.ids.length
            ? `Togli ${line.name} dalla lista`
            : `Togli dalla lista quello che hai aggiunto a ${line.name}`
        }
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </form>
  )
}
```

The two labels are not decoration: on a part-generated line the button does not remove the line, and a label saying it does would be a lie.

- [ ] **Step 2: The list**

`components/shopping/shopping-list.tsx`: `ShoppingGroup` becomes `{ aisle: string; lines: ShoppingRow[] }`, the component takes `dayLabels: string[]` and passes it down, `group.lines.map(...)` replaces `group.items.map(...)`, `key={line.key}`, and the `left` count reads:

```tsx
const left = groups
  .flatMap((group) => group.lines)
  .filter((line) => !line.checked).length
```

The live region's wording is unchanged: it counts lines, and a merged line is one thing to pick up.

- [ ] **Step 3: The page**

`app/(app)/spesa/[weekStart]/page.tsx`:

```tsx
import { dayLabels } from "@/lib/week"
import { groupByAisle, mergeLines } from "@/lib/services/shopping-view"
import { getShoppingList } from "@/lib/services/shopping-lists"
```

and, where it rendered the list:

```tsx
<ShoppingList
  groups={groupByAisle(mergeLines(list.items))}
  dayLabels={dayLabels(weekStart)}
  weekStart={week}
  toggleAction={toggle}
  removeAction={removeItem}
/>
```

- [ ] **Step 4: Run the gate**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Expected: green.

- [ ] **Step 5: See it**

At 390px, on a week with a generated list: a line needed by two recipes on different days shows both. Add `pomodori`, `200`, `g` through the form still at the foot — it merges with the generated line and the sum is right. Untick it: both halves untick.

- [ ] **Step 6: Run the design skill, then commit**

Run `web-design-guidelines` over `components/shopping/shopping-item-row.tsx` and `components/shopping/shopping-list.tsx`. Address or explicitly dismiss.

```bash
git add components app
git commit -m "feat: the list shows one line per thing, and which days it is for

Days sit after the quantity in the same small grey, because they answer the
same kind of question. Above three they truncate to two and a count — but the
full list stays in an sr-only span, because \"+2\" is not a day.

The bin's label changes on a part-generated line: it removes what you added and
leaves what the menu asks for, and a label saying otherwise would be a lie.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The `+`, and anything you like on the list

**Files:**

- Create: `components/shopping/add-item-drawer.tsx`
- Delete: `components/shopping/add-item-form.tsx`
- Modify: `lib/schemas/shopping.ts`, `lib/schemas/shopping.test.ts`
- Modify: `lib/services/shopping-lists.ts`
- Modify: `app/(app)/spesa/[weekStart]/actions.ts`, `app/(app)/spesa/[weekStart]/page.tsx`

**Interfaces:**

- Consumes: `CatalogItemKindSchema` from `lib/schemas/catalog` (plan A); `isKnownAisle`, `listCatalogOptions`, `CatalogOption` from `lib/services/catalog` (plan A).
- Produces:
  - `AddShoppingItemSchema` → `ManualItem & { remember: boolean; kind: "INGREDIENT" | "PRODUCT" }`
  - `addManualItem(weekStart: Date, input: AddShoppingItem): Promise<void>` — same name, wider input
  - `AddItemState = { ok: boolean; message: string | null }`, declared in `components/shopping/add-item-drawer.tsx` and imported by the action — the convention `SlotFormState` already sets: the component owns the shape it renders, the action fills it in
  - `addItem(state: AddItemState, formData: FormData): Promise<AddItemState>` — now a `useActionState` action

- [ ] **Step 1: Write the failing schema test**

Append to `lib/schemas/shopping.test.ts`:

```ts
describe("AddShoppingItemSchema", () => {
  const base = {
    name: "shampoo",
    aisle: "casa e pulizia",
    quantity: null,
    unit: null,
  }

  it("remembers by default is the caller's business, not the schema's", () => {
    expect(
      AddShoppingItemSchema.safeParse({ ...base, kind: "PRODUCT" }).success
    ).toBe(false)
  })

  it("takes both flags", () => {
    expect(
      AddShoppingItemSchema.parse({
        ...base,
        remember: true,
        kind: "PRODUCT",
      })
    ).toEqual({ ...base, remember: true, kind: "PRODUCT" })
  })

  it("still lowercases the name", () => {
    expect(
      AddShoppingItemSchema.parse({
        ...base,
        name: "Shampoo",
        remember: false,
        kind: "PRODUCT",
      }).name
    ).toBe("shampoo")
  })

  it("rejects a kind nobody defined", () => {
    expect(
      AddShoppingItemSchema.safeParse({
        ...base,
        remember: true,
        kind: "HOUSEHOLD",
      }).success
    ).toBe(false)
  })
})
```

The first case is deliberate: `remember` has no default here. A checkbox that is not ticked posts nothing, so the _action_ decides what a missing field means, and the schema stays honest about having been given a boolean.

- [ ] **Step 2: Run it and watch it fail, then implement**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/schemas/shopping.test.ts
```

Then, in `lib/schemas/shopping.ts`:

```ts
import { CatalogItemKindSchema } from "@/lib/schemas/catalog"

// What the drawer posts: a line, plus what to do about the catalogue. Separate
// from ManualItemSchema because the line itself does not care — see design
// document section 7.
export const AddShoppingItemSchema = ManualItemSchema.extend({
  // Opt-out, and phrased as one in the UI: the request was that shampoo should
  // not be re-typed with its aisle re-chosen every week.
  remember: z.boolean(),
  kind: CatalogItemKindSchema,
})

export type AddShoppingItem = z.infer<typeof AddShoppingItemSchema>
```

Run the test again: PASS.

- [ ] **Step 3: Widen the service**

In `lib/services/shopping-lists.ts`, replace `addManualItem`:

```ts
/**
 * Adds a line by hand, and remembers it in the catalogue unless told not to.
 *
 * The line survives every later regeneration, because the aggregator holds
 * hand-added rows apart from generated ones. Both writes are one transaction: a
 * line pointing at a catalogue entry that failed to be created is the kind of
 * half-write that is found a week later.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param input The validated line, with what to do about the catalogue.
 * @returns Nothing.
 * @throws NoListError When the week has no list to add to.
 */
export async function addManualItem(
  weekStart: Date,
  input: AddShoppingItem
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  const listId = menu.list.id
  // An aisle nobody recognises would sort with the catch-all anyway; making it
  // the catch-all keeps the stored row honest about where it will show.
  const aisle = isKnownAisle(input.aisle) ? input.aisle : AISLE_UNKNOWN

  await db.$transaction(async (tx) => {
    if (input.remember) {
      // Upsert and not create: both phones can add the same new thing at once,
      // and the second must still get its line rather than losing the write.
      // `update: {}` because an entry that already exists was curated by
      // somebody, and a shopping line is not the place to overwrite it.
      await tx.catalogItem.upsert({
        where: { name: input.name },
        update: {},
        create: {
          name: input.name,
          kind: input.kind,
          defaultUnit: input.unit,
          aisle,
        },
      })
    }

    await tx.shoppingListItem.create({
      data: {
        listId,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        aisle,
        manual: true,
        days: [],
      },
    })
  })
}
```

Import `isKnownAisle` from `@/lib/services/catalog` and drop the now-unused `AISLE_ORDER` import.

- [ ] **Step 4: Turn `addItem` into a `useActionState` action**

In `app/(app)/spesa/[weekStart]/actions.ts`:

The state type is imported, not declared here — `app/(app)/menu/[weekStart]/actions.ts` already imports `SlotFormState` from the drawer that renders it, and two declarations of one shape drift:

```ts
import type { AddItemState } from "@/components/shopping/add-item-drawer"

export async function addItem(
  _state: AddItemState,
  formData: FormData
): Promise<AddItemState> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const input = AddShoppingItemSchema.safeParse({
    name: formData.get("name"),
    aisle: formData.get("aisle") ?? "",
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    // An unticked checkbox posts nothing at all, so absent means "remember" —
    // the box is «Non salvare nel catalogo» and unticked by default.
    remember: formData.get("skipCatalog") !== "1",
    kind: formData.get("kind") ?? "PRODUCT",
  })

  if (!weekStart.success) return { ok: false, message: "Settimana non valida." }
  if (!input.success) {
    return {
      ok: false,
      message: input.error.issues[0]?.message ?? "Controlla i campi.",
    }
  }

  await requireSession()

  try {
    await addManualItem(weekStart.data, input.data)
  } catch (error) {
    if (error instanceof NoListError) {
      return { ok: false, message: "Questa settimana non ha una lista." }
    }
    throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
  return { ok: true, message: null }
}
```

The old version swallowed every refusal and re-rendered as if nothing had happened, which is how a quantity can vanish without a word — see Task 1.

- [ ] **Step 5: The drawer**

`components/shopping/add-item-drawer.tsx`. It follows `components/menu/slot-drawer.tsx`: `useActionState`, close on `state.ok`, and `useAttempt` to remount the uncontrolled fields so React 19's reset does not fight the echoed values.

```tsx
"use client"

import { Plus } from "lucide-react"
import { useActionState, useEffect, useState } from "react"

import { IngredientPicker } from "@/components/ingredients/ingredient-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAttempt } from "@/hooks/use-attempt"
import { AISLE_UNKNOWN } from "@/lib/aisles"

export type CatalogEntry = {
  name: string
  defaultUnit: string | null
  aisle: string
}

export type AddItemState = { ok: boolean; message: string | null }

export type AddItemAction = (
  state: AddItemState,
  formData: FormData
) => Promise<AddItemState>

const EMPTY: AddItemState = { ok: false, message: null }

export function AddItemDrawer({
  weekStart,
  catalog,
  aisles,
  action,
}: {
  weekStart: string
  catalog: CatalogEntry[]
  aisles: readonly string[]
  action: AddItemAction
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(action, EMPTY)
  const attempt = useAttempt(state)
  const [name, setName] = useState("")
  const [aisle, setAisle] = useState(AISLE_UNKNOWN)
  const [unit, setUnit] = useState("")
  // The picker keeps the typed query in its own state, which no prop can reach.
  // Remounting it is the only way to empty it.
  const [pickerKey, setPickerKey] = useState(0)

  const reset = () => {
    setName("")
    setAisle(AISLE_UNKNOWN)
    setUnit("")
    setPickerKey((key) => key + 1)
  }

  useEffect(() => {
    if (state.ok) {
      setOpen(false)
      reset()
    }
  }, [state])

  // Case-insensitively, because the name is lowercased server-side and the
  // catalogue is all lowercase: typing "Shampoo" must not offer to create a
  // second entry for one that exists.
  const typed = name.trim().toLowerCase()
  const isNew =
    typed.length > 0 && !catalog.some((entry) => entry.name === typed)

  // Picking a catalogue entry fills in what the catalogue already knows, so
  // "mele" lands in ortofrutta without anyone choosing it. Both stay editable:
  // this is a shopping line, not a change to the catalogue.
  const choose = (chosen: string) => {
    setName(chosen)
    const entry = catalog.find((item) => item.name === chosen)
    if (entry === undefined) return
    setAisle(entry.aisle)
    setUnit(entry.defaultUnit ?? "")
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Aggiungi alla lista"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
      </Button>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Aggiungi alla lista</DrawerTitle>
          <DrawerDescription>
            Qualsiasi cosa: un ingrediente, lo shampoo, i sacchetti.
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="name" value={name} />

          <FieldGroup key={attempt}>
            <Field>
              {/* The visible text and the picker's aria-label say the same
                  thing on purpose: the combobox names itself, so a label
                  reading something else would leave sighted and screen-reader
                  users with two different names for one control. */}
              <FieldLabel htmlFor="item-name">Che cosa serve</FieldLabel>
              <IngredientPicker
                key={pickerKey}
                id="item-name"
                names={catalog.map((entry) => entry.name)}
                value={name === "" ? null : name}
                onSelect={choose}
                onCreate={setName}
                aria-label="Che cosa serve"
              />
            </Field>

            <div className="flex gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="quantity">Quantità</FieldLabel>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  inputMode="decimal"
                  // Not min={0}: the schema rejects zero and the drawer would
                  // have to explain a refusal the browser can prevent.
                  min={0.01}
                  step="any"
                  autoComplete="off"
                />
              </Field>

              <Field className="flex-1">
                <FieldLabel htmlFor="unit">Unità</FieldLabel>
                <Input
                  id="unit"
                  name="unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="aisle">Reparto</FieldLabel>
              {/* Base UI reports a cleared selection as null. There is no "no
                  aisle" state here — the list sorts by it — so a clear falls
                  back to the catch-all rather than leaving the field empty. */}
              <Select
                name="aisle"
                value={aisle}
                onValueChange={(next: string | null) =>
                  setAisle(next ?? AISLE_UNKNOWN)
                }
              >
                <SelectTrigger id="aisle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Only for a name the catalogue does not hold. On one it already
                has there is nothing to decide, and two fields asking anyway is
                how a drawer stops being quick. */}
            {isNew ? (
              <>
                <Field>
                  <FieldLabel htmlFor="kind">Tipo</FieldLabel>
                  <Select name="kind" defaultValue="PRODUCT">
                    <SelectTrigger id="kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INGREDIENT">Ingrediente</SelectItem>
                      <SelectItem value="PRODUCT">Prodotto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription id="kind-description">
                    Solo un ingrediente compare fra quelli scegliibili in una
                    ricetta.
                  </FieldDescription>
                </Field>

                <Field orientation="horizontal">
                  <Checkbox id="skipCatalog" name="skipCatalog" value="1" />
                  <FieldLabel htmlFor="skipCatalog">
                    Non salvare nel catalogo
                  </FieldLabel>
                </Field>
              </>
            ) : null}
          </FieldGroup>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending || name.trim() === ""}>
              {isPending ? "Aggiungo…" : "Aggiungi"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

If `Checkbox` does not post `value` as a native input — Base UI wraps a hidden one — check what `formData.get("skipCatalog")` actually receives before trusting the `!== "1"` in Step 4, and adjust the action to whatever it posts. `"on"` is the other likely answer.

- [ ] **Step 6: Put it in the header, delete the old form**

In `app/(app)/spesa/[weekStart]/page.tsx`, inside `PageHeader`'s children, before the «Rigenera» form:

```tsx
{
  list === null ? null : (
    <AddItemDrawer
      weekStart={week}
      catalog={catalog}
      aisles={AISLE_ORDER}
      action={addItem}
    />
  )
}
```

Delete the `<AddItemForm …/>` at the foot and its import, and `git rm components/shopping/add-item-form.tsx`. `listCatalogOptions()` already feeds `catalog`; only the variable name changes.

- [ ] **Step 7: Run the gate, the design skill, and commit**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Run `web-design-guidelines` over `components/shopping/add-item-drawer.tsx` and the page.

```bash
git add app components lib
git rm components/shopping/add-item-form.tsx
git commit -m "feat: adding a line moves into a drawer, and takes anything

The + sits in the header and opens the same drawer shape the menu's slots use,
so the two screens read as one app. A name the catalogue does not hold gets two
extra fields and only then: a Tipo defaulting to Prodotto, because what gets
cooked with is normally created from the recipe form, and an opt-out checkbox,
because the point of the request was not re-typing shampoo every week.

The catalogue entry and the shopping line are one transaction, and the action
now returns its refusals instead of swallowing them and re-rendering as if
nothing had happened.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: The browser checklist, and the roadmap

**Files:**

- Modify: `docs/roadmap.md`

- [ ] **Step 1: Walk the checklist at 390px**

Reuse the running `pnpm dev`. Every point is pass or fail; a fail is fixed before the plan closes.

1. `/spesa/<current week>` with a generated list: each line shows quantity and unit, and the days after them in the same small grey.
2. A line two recipes on different days both need shows both days, comma-separated.
3. A line five days need shows two days and `+3`.
4. The header carries a `+` and «Rigenera», in that order, and neither wraps.
5. `+` opens the drawer. It has no Tipo and no checkbox yet, because nothing is typed.
6. Type `pomodori` — an existing entry: the aisle and unit fill in, and **no** Tipo or checkbox appears.
7. Quantity `200`, submit: the drawer closes and the line reads the **sum** of the generated quantity and 200. **This is the case Task 1 was about — the quantity must be there.**
8. Untick that line: it unticks. Tick it: it ticks. Refresh: it is still ticked.
9. The bin on that line removes only the 200 g; the generated quantity stays.
10. `+`, type `Shampoo`: Tipo appears defaulting to `Prodotto`, and the checkbox «Non salvare nel catalogo» appears unticked.
11. Reparto `casa e pulizia`, submit. The line appears under «casa e pulizia», lowercase, with no days.
12. `/catalogo?tipo=prodotti` lists **shampoo**.
13. `+`, type `carta forno`, tick «Non salvare nel catalogo», submit. The line appears; `/catalogo` does **not** list it.
14. Press «Rigenera»: shampoo and carta forno are still on the list, the generated lines are rebuilt, the days are still right.
15. With a screen reader or the accessibility inspector, the truncated days line reads the full list, not `+3`.

- [ ] **Step 2: Update the roadmap**

Add a row to Shipped:

```markdown
| [`2026-08-18-shopping-list-again`](superpowers/plans/2026-08-18-shopping-list-again.md) | `days` on a line, `lib/services/shopping-view.ts` and its merge, the `+` drawer, and free items landing in the catalogue |
```

Update `Last updated:`. Under the standing decisions, add the one that will otherwise be undone by someone tidying:

> **Duplicate shopping rows are merged in the read path, not in the database — 2026-08-18.** `mergeLines` in `lib/services/shopping-view.ts` unites rows with the same name and unit when the list is rendered. The rows stay apart in Postgres on purpose: a regeneration deletes the generated rows and rebuilds them, and a hand-added quantity has to survive that. Do not "fix" it by summing on the way in.

If Task 1 found something worth keeping, put its paragraph here too.

- [ ] **Step 3: Commit and finish the branch**

```bash
git add docs/roadmap.md
git commit -m "docs: record the shopping-list revision as shipped

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

Then `superpowers:finishing-a-development-branch`. One PR, squash-merged, branch deleted. Plan C is cut from `main`.
