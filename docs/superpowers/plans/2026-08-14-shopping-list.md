# Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a week's menu into a list you can walk the shop with — grouped in walking order, ticked from either phone, and honest about when the menu has moved on underneath it.

**Architecture:** A fourth module under `app/(app)/spesa/`. The hard part is already done and must not be rewritten: `aggregateShoppingList` in `lib/services/shopping-aggregate.ts` is pure, covered by 17 tests, and implements steps 2 to 8 of §6.3 including the merge with the previous list. This plan builds everything around it — loading the slots into the shape it wants, writing its output back, the screen, ticking, manual items, and a freshness signal.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`base-mira` / `mist`).

**Spec:** `docs/superpowers/specs/2026-08-13-menu-spesa-design.md` — §6.3 (the whole flow, step by step), §5 and its design notes (`ShoppingListItem.manual`, the scaling factor), §4.3 (UI rules), §8 (last-write-wins on concurrent ticks).

## Decisions taken with the owner on 2026-08-14

Before writing. They are not open again inside the plan:

- **Generation is explicit, and staleness is visible.** A button generates the list; it then persists. If the menu is edited afterwards, the list screen says so. This costs a migration — see Task 1. The alternative, trusting whoever edits the menu to remember, protects the editor and not the person who is actually in the shop, and §6.1 already states the principle: a shopping list that lies is worse than no shopping list.
- **The manual-item form pre-fills from the catalogue.** The name field is a combobox over the ingredient catalogue. Picking an entry fills the aisle from `Ingredient.aisle` and the unit from `Ingredient.defaultUnit`; free text that matches nothing gets the `altro` aisle and no unit. Both stay editable, and the quantity is optional.
- **Nobody is shown who ticked what.** `checkedById` and `checkedAt` are written, because they cost nothing and the shopping list is the one screen two people touch at once, but no screen renders them. There are two users; the answer is always obvious.
- **Generated rows cannot be deleted, manual rows can.** Deleting a generated row would be undone by the next regeneration, so the button would lie about what it does.
- **A manual item never merges with a generated one.** Adding "olio" by hand while a recipe also needs it leaves two lines. This is `aggregateShoppingList` behaving as designed and tested — manual items are held apart from generated ones, and that separation is exactly what makes them survive regeneration. Do not "fix" it.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited. Control sizing is whatever the registry generates.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; add `nativeButton={false}` when `render` yields a non-button **and** the component wraps the Base UI Button primitive.
- **Use the page primitives.** `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton` in `components/page/`. Do not rebuild them and do not add a boolean prop to one.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth` — `lib/config`, `lib/week` and `lib/aisles` are leaf modules and are allowed. `lib/schemas/**` imports Zod and its own siblings, nothing else. ESLint fails the build.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **`actorId` is reserved.** It means an identity the caller already verified, and it comes from `requireSession()`, never from a form field. A client-supplied id passed as `actorId` is how this architecture produces an IDOR — see `docs/conventions/architecture.md`.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws`. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads**, including every Zod message. English for identifiers, comments, TSDoc, commit messages.
- **Schema changes go through a migration.** Never edit the database by hand.
- **Phone first at 390px.** Theme tokens only, no hex, no raw palette classes.
- **`pnpm verify` is the gate.**

## Testing

Per `docs/conventions/testing.md`: the Zod schemas and the pure functions are tested; the React components are not — `vitest.config.ts` runs `environment: "node"` with no DOM. `aggregateShoppingList` is already covered by 17 tests and this plan adds none to it. Component tasks verify with `pnpm verify` plus a written manual browser check.

## The shell

If a command fails with `"node" non è riconosciuto`, the Git Bash PATH carries a broken `app.asar` entry. Run `pnpm` and `git` through PowerShell, and strip the entry for the commit in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
git commit -m "…"
```

Never `--no-verify`.

---

## File Structure

**Created**

| File                                        | Responsibility                                      |
| ------------------------------------------- | --------------------------------------------------- |
| `lib/schemas/shopping.ts`                   | the manual-item and item-id contracts               |
| `lib/schemas/shopping.test.ts`              | covers them                                         |
| `lib/services/shopping-lists.ts`            | load, regenerate, tick, add and remove              |
| `lib/services/shopping-lists.test.ts`       | covers `isListStale` and `groupByAisle`             |
| `components/ui/checkbox.tsx`                | generated by the CLI                                |
| `components/shopping/shopping-item-row.tsx` | one row, its checkbox and its optimistic state      |
| `components/shopping/add-item-form.tsx`     | the manual-item form, pre-filled from the catalogue |
| `components/shopping/shopping-list.tsx`     | the aisle groups and the focus/interval refresh     |
| `app/(app)/spesa/page.tsx`                  | redirects to the current week                       |
| `app/(app)/spesa/[weekStart]/page.tsx`      | the list                                            |
| `app/(app)/spesa/[weekStart]/actions.ts`    | `regenerate`, `toggle`, `addItem`, `removeItem`     |
| `app/(app)/spesa/[weekStart]/loading.tsx`   | delegates to `ListSkeleton`                         |
| `app/(app)/spesa/[weekStart]/error.tsx`     | delegates to `PageError`                            |

**Modified**

| File                                  | Change                                            |
| ------------------------------------- | ------------------------------------------------- |
| `prisma/schema.prisma`                | `Menu.slotsUpdatedAt`, `ShoppingList.generatedAt` |
| `lib/services/menus.ts`               | `setSlot` and `clearSlot` touch `slotsUpdatedAt`  |
| `lib/services/ingredients.ts`         | `listIngredientsWithAisle`                        |
| `components/app-sidebar.tsx`          | one entry in `NAV_ITEMS`, after "Menù"            |
| `app/(app)/menu/[weekStart]/page.tsx` | a link through to that week's list                |
| `docs/roadmap.md`                     | the shopping-list row moves out of "Not started"  |

---

## Task 1: Knowing the list is out of date

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `lib/services/menus.ts`
- Modify: `lib/services/menus.test.ts`

**Interfaces:**

- Produces:
  - `Menu.slotsUpdatedAt: DateTime` — when a slot in this week last changed
  - `ShoppingList.generatedAt: DateTime` — when the list was last built
  - `isListStale(slotsUpdatedAt: Date, generatedAt: Date): boolean` — exported from `lib/services/menus.ts`

**Why two explicit columns and not `@updatedAt`.** `@updatedAt` fires when _that row_ is updated. Writing a `MenuSlot` does not update its `Menu`, and replacing a list's items does not update its `ShoppingList`, so both would sit still exactly when we need them to move. Two plain columns written deliberately say what they mean and can be tested.

**Why a spurious "stale" is acceptable and a spurious "fresh" is not.** `setSlot` touches the menu before writing the slot, so a failed slot write leaves the menu looking newer than it is. The list then says "the menu has changed" when it has not, and the cost is one unnecessary regeneration. The opposite error sends someone to the shop with a list that quietly no longer matches. Keep the order.

- [ ] **Step 1: Write the failing test**

Append to `lib/services/menus.test.ts`:

```ts
import { isListStale } from "@/lib/services/menus"

describe("isListStale", () => {
  it("is stale when the menu changed after the list was built", () => {
    expect(
      isListStale(
        new Date("2026-08-14T10:00:00Z"),
        new Date("2026-08-14T09:00:00Z")
      )
    ).toBe(true)
  })

  it("is not stale when the list was built after the menu changed", () => {
    expect(
      isListStale(
        new Date("2026-08-14T09:00:00Z"),
        new Date("2026-08-14T10:00:00Z")
      )
    ).toBe(false)
  })

  it("is not stale on the same instant — generating right after an edit is the normal case", () => {
    const now = new Date("2026-08-14T10:00:00Z")
    expect(isListStale(now, now)).toBe(false)
  })
})
```

Add `isListStale` to the existing import at the top of that file.

- [ ] **Step 2: Run it and watch it fail**

```powershell
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: FAIL — `isListStale` is not exported.

- [ ] **Step 3: Change the schema**

In `prisma/schema.prisma`, add one field to `Menu`:

```prisma
model Menu {
  id        String        @id @default(cuid())
  weekStart DateTime      @unique @db.Date
  slots     MenuSlot[]
  list      ShoppingList?
  createdAt DateTime      @default(now())
  // Written deliberately by setSlot and clearSlot. Not `@updatedAt`: writing a
  // MenuSlot does not update its Menu, so `@updatedAt` would never fire for
  // the change that actually matters here.
  slotsUpdatedAt DateTime @default(now())
}
```

and one to `ShoppingList`:

```prisma
model ShoppingList {
  id        String             @id @default(cuid())
  menuId    String             @unique
  menu      Menu               @relation(fields: [menuId], references: [id], onDelete: Cascade)
  items     ShoppingListItem[]
  createdAt DateTime           @default(now())
  // Set on every regeneration. Replacing the child items does not touch this
  // row, so `@updatedAt` would stand still across exactly the event it names.
  generatedAt DateTime         @default(now())
}
```

- [ ] **Step 4: Migrate**

```powershell
pnpm db:migrate
```

Name it `shopping_list_freshness` when prompted. Both columns default to `now()`, so the rows already in the database get a sane value.

- [ ] **Step 5: Touch the menu when a slot changes**

In `lib/services/menus.ts`, add the exported predicate next to the other pure functions:

```ts
/**
 * Says whether a shopping list has been overtaken by its menu.
 *
 * Exported for its own test. Equal instants are not stale: generating the list
 * straight after editing the menu is the normal case, not a warning.
 *
 * @param slotsUpdatedAt When a slot of the week last changed.
 * @param generatedAt When the list was last built.
 * @returns True when the menu moved after the list was built.
 */
export function isListStale(slotsUpdatedAt: Date, generatedAt: Date): boolean {
  return slotsUpdatedAt.getTime() > generatedAt.getTime()
}
```

Change `setSlot` so the menu upsert records the change instead of doing nothing:

```ts
const menu = await db.menu.upsert({
  where: { weekStart },
  create: { weekStart },
  // Was `{}`. The week itself has not changed, but its slots are about to,
  // and the shopping list needs to know.
  update: { slotsUpdatedAt: new Date() },
  select: { id: true },
})
```

Change `clearSlot` so the delete and the touch cannot come apart:

```ts
export async function clearSlot(
  weekStart: Date,
  day: number,
  meal: Meal
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { id: true },
  })

  if (menu === null) return

  // One transaction: a delete that landed without its touch would leave the
  // shopping list claiming to be current while an item had just left the menu.
  await db.$transaction([
    db.menuSlot.deleteMany({ where: { menuId: menu.id, day, meal } }),
    db.menu.update({
      where: { id: menu.id },
      data: { slotsUpdatedAt: new Date() },
    }),
  ])
}
```

- [ ] **Step 6: Run the tests**

```powershell
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: 8 passed.

- [ ] **Step 7: Verify**

```powershell
pnpm verify
```

Expected: green, 142 tests.

- [ ] **Step 8: Commit**

```powershell
git add prisma lib/services
git commit -m "feat: record when a week's slots last changed"
```

---

## Task 2: The contracts

**Files:**

- Create: `lib/schemas/shopping.ts`
- Create: `lib/schemas/shopping.test.ts`

**Interfaces:**

- Consumes: `INGREDIENT_NAME_MAX` and `UNIT_MAX` from `@/lib/schemas/ingredient` — a sibling import, which `lib/schemas/recipe.ts` already does.
- Produces:
  - `ShoppingItemIdSchema` → `string`
  - `ManualItemSchema` → `{ name: string; aisle: string; quantity: number | null; unit: string | null }`
  - `type ManualItem`

**Why the aisle is a plain string here too.** Same reason as `IngredientInputSchema`: `lib/schemas/**` cannot reach `AISLE_ORDER` in `lib/aisles.ts`. Membership is checked in the service. Do not import `@/lib/aisles` into a schema.

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/shopping.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ManualItemSchema, ShoppingItemIdSchema } from "@/lib/schemas/shopping"

describe("ShoppingItemIdSchema", () => {
  it("accepts a cuid", () => {
    expect(ShoppingItemIdSchema.parse("cm3xk1p2h0000abcdefghijkl")).toBe(
      "cm3xk1p2h0000abcdefghijkl"
    )
  })

  it("rejects anything else", () => {
    expect(ShoppingItemIdSchema.safeParse("42").success).toBe(false)
  })
})

describe("ManualItemSchema", () => {
  const valid = {
    name: "detersivo",
    aisle: "casa e pulizia",
    quantity: null,
    unit: null,
  }

  it("accepts a bare name and an aisle", () => {
    expect(ManualItemSchema.parse(valid)).toEqual(valid)
  })

  it("accepts a quantity with its unit", () => {
    expect(
      ManualItemSchema.parse({ ...valid, quantity: 2, unit: "pz" })
    ).toMatchObject({ quantity: 2, unit: "pz" })
  })

  it("trims the name", () => {
    expect(
      ManualItemSchema.parse({ ...valid, name: "  sacchetti " }).name
    ).toBe("sacchetti")
  })

  it("rejects an empty name", () => {
    const result = ManualItemSchema.safeParse({ ...valid, name: "   " })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Scrivi che cosa serve.")
    }
  })

  it("rejects an empty aisle, because the list is sorted by it", () => {
    expect(ManualItemSchema.safeParse({ ...valid, aisle: "" }).success).toBe(
      false
    )
  })

  it("turns a blank unit into null, so it is absent rather than empty", () => {
    expect(ManualItemSchema.parse({ ...valid, unit: "  " }).unit).toBeNull()
  })

  it("rejects a quantity of zero, which would ask for nothing", () => {
    expect(ManualItemSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(
      false
    )
  })

  it("rejects a negative quantity", () => {
    expect(ManualItemSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(
      false
    )
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
pnpm exec vitest run lib/schemas/shopping.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the schemas**

Create `lib/schemas/shopping.ts`:

```ts
import { z } from "zod"

import { INGREDIENT_NAME_MAX, UNIT_MAX } from "@/lib/schemas/ingredient"

export const ShoppingItemIdSchema = z.cuid("Questa riga non è valida.")

export const ManualItemSchema = z.object({
  // Not IngredientNameSchema: a manual item is free text and need not exist in
  // the catalogue — "sacchetti" never will. Only the length is shared.
  name: z
    .string()
    .trim()
    .min(1, "Scrivi che cosa serve.")
    .max(
      INGREDIENT_NAME_MAX,
      `Il nome può avere al massimo ${INGREDIENT_NAME_MAX} caratteri.`
    ),
  // A plain string, not an enum: lib/schemas may import Zod and its siblings,
  // so AISLE_ORDER is out of reach. The service checks membership.
  aisle: z
    .string()
    .trim()
    .min(1, "Scegli un reparto.")
    .max(50, "Il reparto può avere al massimo 50 caratteri."),
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
  unit: z
    .string()
    .trim()
    .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
    .nullable()
    .transform((value) => (value === null || value === "" ? null : value)),
})

export type ManualItem = z.infer<typeof ManualItemSchema>
```

- [ ] **Step 4: Run them and watch them pass**

```powershell
pnpm exec vitest run lib/schemas/shopping.test.ts
```

Expected: 10 passed.

- [ ] **Step 5: Verify**

```powershell
pnpm verify
```

Expected: green, 152 tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/schemas
git commit -m "feat: add the shopping list contracts"
```

---

## Task 3: The service

**Files:**

- Create: `lib/services/shopping-lists.ts`
- Create: `lib/services/shopping-lists.test.ts`
- Modify: `lib/services/ingredients.ts`

**Interfaces:**

- Consumes: `aggregateShoppingList`, `type ShoppingItem`, `type AggregatorSlot` from `@/lib/services/shopping-aggregate`; `isListStale` from `@/lib/services/menus`; `ManualItem` from `@/lib/schemas/shopping`; `AISLE_ORDER`, `AISLE_UNKNOWN`, `aisleRank` from `@/lib/aisles`.
- Produces:
  - `type StoredItem = ShoppingItem & { id: string }`
  - `type AisleGroup = { aisle: string; items: StoredItem[] }`
  - `type ShoppingListView = { items: StoredItem[]; generatedAt: Date; stale: boolean } | null`
  - `groupByAisle(items: StoredItem[]): AisleGroup[]`
  - `getShoppingList(weekStart: Date): Promise<ShoppingListView>`
  - `regenerateShoppingList(weekStart: Date): Promise<void>`
  - `setItemChecked(id: string, actorId: string, checked: boolean): Promise<void>`
  - `addManualItem(weekStart: Date, input: ManualItem): Promise<void>`
  - `removeManualItem(id: string): Promise<void>`
  - `class NoMenuError`, `class NoListError`
  - In `lib/services/ingredients.ts`: `type CatalogueOption`, `listIngredientsWithAisle(): Promise<CatalogueOption[]>`

**Do not touch `lib/services/shopping-aggregate.ts`.** It is pure, it implements §6.3 steps 2 to 8, and it has 17 tests. This module's job is to hand it the right input and store what comes back.

- [ ] **Step 1: Write the failing test**

Create `lib/services/shopping-lists.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { groupByAisle, type StoredItem } from "@/lib/services/shopping-lists"

const item = (over: Partial<StoredItem>): StoredItem => ({
  id: "cm3xk1p2h0000abcdefghijkl",
  name: "mele",
  quantity: null,
  unit: null,
  aisle: "ortofrutta",
  checked: false,
  checkedById: null,
  checkedAt: null,
  manual: false,
  ...over,
})

describe("groupByAisle", () => {
  it("returns nothing for an empty list", () => {
    expect(groupByAisle([])).toEqual([])
  })

  it("puts the aisles in walking order, not alphabetical order", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "latte", aisle: "banco frigo" }),
      item({ id: "b", name: "mele", aisle: "ortofrutta" }),
    ])

    expect(groups.map((group) => group.aisle)).toEqual([
      "ortofrutta",
      "banco frigo",
    ])
  })

  it("keeps the catch-all last, whatever its name would sort as", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "sacchetti", aisle: "altro" }),
      item({ id: "b", name: "vino", aisle: "bevande" }),
    ])

    expect(groups[groups.length - 1].aisle).toBe("altro")
  })

  it("gathers every item of one aisle into a single group", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "mele", aisle: "ortofrutta" }),
      item({ id: "b", name: "latte", aisle: "banco frigo" }),
      item({ id: "c", name: "pere", aisle: "ortofrutta" }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0].items.map((i) => i.name)).toEqual(["mele", "pere"])
  })

  it("sorts within an aisle by name, in Italian", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "zucchine" }),
      item({ id: "b", name: "àglio" }),
      item({ id: "c", name: "mele" }),
    ])

    expect(groups[0].items.map((i) => i.name)).toEqual([
      "àglio",
      "mele",
      "zucchine",
    ])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```powershell
pnpm exec vitest run lib/services/shopping-lists.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Add the catalogue read**

In `lib/services/ingredients.ts`, next to `listIngredients`:

```ts
export type CatalogueOption = IngredientOption & { aisle: string }

/**
 * Lists the catalogue with each entry's aisle, for the manual-item form.
 *
 * Distinct from `listIngredients`, which the recipe form uses and which has no
 * need of the aisle, and from `listIngredientsWithUsage`, which counts recipes
 * per entry and is the catalogue screen's query.
 *
 * @returns Every ingredient with its preferred unit and its aisle, by name.
 */
export async function listIngredientsWithAisle(): Promise<CatalogueOption[]> {
  return db.ingredient.findMany({
    select: { name: true, defaultUnit: true, aisle: true },
    orderBy: { name: "asc" },
  })
}
```

- [ ] **Step 4: Write the service**

Create `lib/services/shopping-lists.ts`:

```ts
import { aisleRank, AISLE_ORDER, AISLE_UNKNOWN } from "@/lib/aisles"
import { db } from "@/lib/db"
import type { ManualItem } from "@/lib/schemas/shopping"
import { isListStale } from "@/lib/services/menus"
import {
  aggregateShoppingList,
  type AggregatorSlot,
  type ShoppingItem,
} from "@/lib/services/shopping-aggregate"

/** Thrown when a week has no menu, so there is nothing to shop for. */
export class NoMenuError extends Error {
  constructor() {
    super("This week has no menu.")
    this.name = "NoMenuError"
  }
}

/** Thrown when the list this item belongs to no longer exists. */
export class NoListError extends Error {
  constructor() {
    super("This week has no shopping list.")
    this.name = "NoListError"
  }
}

export type StoredItem = ShoppingItem & { id: string }

export type AisleGroup = { aisle: string; items: StoredItem[] }

export type ShoppingListView = {
  items: StoredItem[]
  generatedAt: Date
  stale: boolean
}

const itemFields = {
  id: true,
  name: true,
  quantity: true,
  unit: true,
  aisle: true,
  checked: true,
  checkedById: true,
  checkedAt: true,
  manual: true,
} as const

/**
 * Gathers the list into the aisles of the supermarket walking order.
 *
 * Exported for its own test. Sorts as well as groups, because the rows arrive
 * from Postgres in whatever order it liked and no SQL `ORDER BY` can express a
 * walking order that is not alphabetical.
 *
 * @param items Every line of the list.
 * @returns One group per aisle that has items, in walking order, each group's
 *   items by name.
 */
export function groupByAisle(items: StoredItem[]): AisleGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )

  const groups: AisleGroup[] = []

  for (const item of sorted) {
    const last = groups[groups.length - 1]
    // Adjacency is enough because the sort already put one aisle's items
    // together, and it keeps an unknown aisle folded in with the catch-all
    // exactly the way aisleRank ranks it.
    if (last !== undefined && aisleRank(last.aisle) === aisleRank(item.aisle)) {
      last.items.push(item)
      continue
    }
    groups.push({ aisle: item.aisle, items: [item] })
  }

  return groups
}

/**
 * Reads a week's list, and whether the menu has moved on since it was built.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns The list, or null when the week has no list yet.
 */
export async function getShoppingList(
  weekStart: Date
): Promise<ShoppingListView | null> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slotsUpdatedAt: true,
      list: {
        select: { generatedAt: true, items: { select: itemFields } },
      },
    },
  })

  if (menu?.list == null) return null

  return {
    items: menu.list.items,
    generatedAt: menu.list.generatedAt,
    stale: isListStale(menu.slotsUpdatedAt, menu.list.generatedAt),
  }
}

/**
 * Rebuilds a week's list from its menu.
 *
 * The aggregation itself is `aggregateShoppingList`, which is pure and already
 * decides what survives: items added by hand, and the tick on anything whose
 * quantity did not rise. Everything here is loading its input and storing its
 * output, in one transaction so a half-written list can never be shopped from.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns Nothing.
 * @throws NoMenuError When the week has no menu to aggregate.
 */
export async function regenerateShoppingList(weekStart: Date): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      id: true,
      slots: {
        select: {
          servings: true,
          recipe: {
            select: {
              servings: true,
              ingredients: {
                select: {
                  quantity: true,
                  unit: true,
                  ingredient: { select: { name: true, aisle: true } },
                },
              },
            },
          },
        },
      },
      list: {
        select: { id: true, items: { select: itemFields } },
      },
    },
  })

  if (menu === null) throw new NoMenuError()

  const slots: AggregatorSlot[] = menu.slots.map((slot) => ({
    servings: slot.servings,
    recipe:
      slot.recipe === null
        ? null
        : {
            servings: slot.recipe.servings,
            ingredients: slot.recipe.ingredients.map((row) => ({
              name: row.ingredient.name,
              aisle: row.ingredient.aisle,
              quantity: row.quantity,
              unit: row.unit,
            })),
          },
  }))

  const next = aggregateShoppingList({
    slots,
    existing: menu.list?.items ?? [],
  })

  const generatedAt = new Date()

  await db.$transaction(async (tx) => {
    const list =
      menu.list === null
        ? await tx.shoppingList.create({
            data: { menuId: menu.id, generatedAt },
            select: { id: true },
          })
        : await tx.shoppingList.update({
            where: { id: menu.list.id },
            data: { generatedAt },
            select: { id: true },
          })

    // Replaced wholesale rather than diffed: the aggregator has already decided
    // the final shape of every line, including which ticks survive, so a diff
    // would be a second implementation of the same rules.
    await tx.shoppingListItem.deleteMany({ where: { listId: list.id } })
    await tx.shoppingListItem.createMany({
      data: next.map((item) => ({ ...item, listId: list.id })),
    })
  })
}

/**
 * Ticks or unticks one line, recording who did it.
 *
 * Last-write-wins per item, which §8 of the design accepts at this scale: two
 * people and a checkbox.
 *
 * @param id The line's id.
 * @param actorId The session's user id — never a value from the request body.
 * @param checked The new state.
 * @returns Nothing.
 * @throws NoListError When the line is already gone.
 */
export async function setItemChecked(
  id: string,
  actorId: string,
  checked: boolean
): Promise<void> {
  const updated = await db.shoppingListItem.updateMany({
    where: { id },
    data: {
      checked,
      checkedById: checked ? actorId : null,
      checkedAt: checked ? new Date() : null,
    },
  })

  if (updated.count === 0) throw new NoListError()
}

/**
 * Adds a line by hand, which survives every later regeneration.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param input The validated line.
 * @returns Nothing.
 * @throws NoListError When the week has no list to add to.
 */
export async function addManualItem(
  weekStart: Date,
  input: ManualItem
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  await db.shoppingListItem.create({
    data: {
      listId: menu.list.id,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      // An aisle nobody recognises would sort with the catch-all anyway; making
      // it the catch-all keeps the stored data honest about where it will show.
      aisle: (AISLE_ORDER as readonly string[]).includes(input.aisle)
        ? input.aisle
        : AISLE_UNKNOWN,
      manual: true,
    },
  })
}

/**
 * Removes a line added by hand.
 *
 * Generated lines are not removable: the next regeneration would bring them
 * back, so the `where` refuses them rather than offering a button that lies.
 *
 * @param id The line's id.
 * @returns Nothing.
 */
export async function removeManualItem(id: string): Promise<void> {
  await db.shoppingListItem.deleteMany({ where: { id, manual: true } })
}
```

- [ ] **Step 5: Run the tests**

```powershell
pnpm exec vitest run lib/services/shopping-lists.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Verify**

```powershell
pnpm verify
```

Expected: green, 157 tests.

- [ ] **Step 7: Commit**

```powershell
git add lib/services
git commit -m "feat: add the shopping list service"
```

---

## Task 4: The row and the add form

**Files:**

- Create: `components/ui/checkbox.tsx` (via CLI)
- Create: `components/shopping/shopping-item-row.tsx`
- Create: `components/shopping/add-item-form.tsx`

**Interfaces:**

- Consumes: `AISLE_ORDER`, `AISLE_UNKNOWN` from `@/lib/aisles`; `IngredientPicker` from `@/components/ingredients/ingredient-picker`.
- Produces:
  - `type ShoppingRow = { id: string; name: string; quantity: number | null; unit: string | null; checked: boolean; manual: boolean }`
  - `ShoppingItemRow({ item, toggleAction, removeAction })`
  - `type CatalogueEntry = { name: string; defaultUnit: string | null; aisle: string }`
  - `AddItemForm({ weekStart, catalogue, aisles, action })`

**Why the tick is optimistic.** The list is used standing in a shop on a phone with one bar of signal. A checkbox that waits for the server before moving reads as broken. `useOptimistic` flips it immediately and the server action reconciles; a failure re-renders it back, which is the honest outcome.

- [ ] **Step 1: Install the checkbox**

```powershell
pnpm dlx shadcn@latest add checkbox
git status --short
pnpm typecheck
```

If the CLI reports that `checkbox` does not exist in the `base-mira` style, **stop and report it** — do not hand-write one.

Then read the installed API before writing against it, the way Task 3 of the menu plan had to for the combobox:

```powershell
Get-Content components/ui/checkbox.tsx | Select-String -Pattern 'onCheckedChange|CheckboxPrimitive|Props' -Context 0,4
```

Base UI's Checkbox is not Radix's. The row below calls `onCheckedChange={(next: boolean) => …}`. **If the installed component hands the callback something else** — an event, or `(checked, event)` — adapt the call site and say so in the task report. Do not change `components/ui/checkbox.tsx`.

- [ ] **Step 2: Write the row**

Create `components/shopping/shopping-item-row.tsx`:

```tsx
"use client"

import { Trash2 } from "lucide-react"
import { useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export type ShoppingRow = {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  checked: boolean
  manual: boolean
}

// "2 pz", "300 g", or nothing at all for an unquantified line like "olio q.b.".
function amountOf(item: ShoppingRow) {
  if (item.quantity === null) return null
  return item.unit === null
    ? `${item.quantity}`
    : `${item.quantity} ${item.unit}`
}

export function ShoppingItemRow({
  item,
  toggleAction,
  removeAction,
}: {
  item: ShoppingRow
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}) {
  const [checked, setChecked] = useOptimistic(item.checked)
  const [, startTransition] = useTransition()
  const amount = amountOf(item)

  return (
    <li className="flex items-center gap-3 py-1">
      <Checkbox
        id={item.id}
        checked={checked}
        onCheckedChange={(next: boolean) => {
          const data = new FormData()
          data.set("id", item.id)
          data.set("checked", next ? "1" : "")

          startTransition(async () => {
            setChecked(next)
            await toggleAction(data)
          })
        }}
      />
      <label
        htmlFor={item.id}
        className={
          checked
            ? "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground line-through"
            : "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm"
        }
      >
        <span className="break-words">{item.name}</span>
        {amount === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {amount}
          </span>
        )}
      </label>

      {item.manual ? (
        <form action={removeAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label={`Togli ${item.name} dalla lista`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </form>
      ) : null}
    </li>
  )
}
```

- [ ] **Step 3: Write the add form**

Create `components/shopping/add-item-form.tsx`:

```tsx
"use client"

import { useState } from "react"

import { IngredientPicker } from "@/components/ingredients/ingredient-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AISLE_UNKNOWN } from "@/lib/aisles"

export type CatalogueEntry = {
  name: string
  defaultUnit: string | null
  aisle: string
}

export function AddItemForm({
  weekStart,
  catalogue,
  aisles,
  action,
}: {
  weekStart: string
  catalogue: CatalogueEntry[]
  aisles: readonly string[]
  action: (formData: FormData) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [aisle, setAisle] = useState(AISLE_UNKNOWN)
  const [unit, setUnit] = useState("")

  // Picking a catalogue entry fills in what the catalogue already knows, so
  // "mele" lands in ortofrutta without anyone choosing it. Both stay editable:
  // this is a shopping line, not a change to the catalogue.
  const choose = (chosen: string) => {
    setName(chosen)
    const entry = catalogue.find((item) => item.name === chosen)
    if (entry === undefined) return
    setAisle(entry.aisle)
    setUnit(entry.defaultUnit ?? "")
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="name" value={name} />

      <Field>
        <FieldLabel htmlFor="item-name">Aggiungi alla lista</FieldLabel>
        <IngredientPicker
          names={catalogue.map((entry) => entry.name)}
          value={name === "" ? null : name}
          onSelect={choose}
          // Free text that matches no catalogue entry is a legitimate shopping
          // line — "sacchetti" will never be an ingredient. Taking it here is
          // what keeps this form from becoming a way to pollute the catalogue.
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
            min={0}
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
        <Select name="aisle" value={aisle} onValueChange={setAisle}>
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

      <Button type="submit" disabled={name.trim() === ""}>
        Aggiungi
      </Button>
    </form>
  )
}
```

`IngredientPicker` is reused rather than copied. Read it before writing against it — its `onCreate` is named for the recipe form's behaviour, where it creates a catalogue entry; here it means "keep this text as typed", which is why the comment above says so.

- [ ] **Step 4: Verify**

```powershell
pnpm verify
```

Expected: green. Nothing renders these yet.

- [ ] **Step 5: Commit**

```powershell
git add components
git commit -m "feat: add the shopping list row and add form"
```

---

## Task 5: The screens

**Files:**

- Create: `components/shopping/shopping-list.tsx`
- Create: `app/(app)/spesa/page.tsx`
- Create: `app/(app)/spesa/[weekStart]/page.tsx`
- Create: `app/(app)/spesa/[weekStart]/actions.ts`
- Create: `app/(app)/spesa/[weekStart]/loading.tsx`
- Create: `app/(app)/spesa/[weekStart]/error.tsx`
- Modify: `components/app-sidebar.tsx`
- Modify: `app/(app)/menu/[weekStart]/page.tsx`

**Interfaces:**

- Consumes: everything from Tasks 1–4, plus `WeekStartSchema` from `@/lib/schemas/menu`, `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton`.
- Produces: the `/spesa` routes.

- [ ] **Step 1: Write the actions**

Create `app/(app)/spesa/[weekStart]/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { ManualItemSchema, ShoppingItemIdSchema } from "@/lib/schemas/shopping"
import {
  addManualItem,
  NoListError,
  NoMenuError,
  regenerateShoppingList,
  removeManualItem,
  setItemChecked,
} from "@/lib/services/shopping-lists"

const iso = (date: Date) => date.toISOString().slice(0, 10)

function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : Number(text)
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : ""
  return text.trim() === "" ? null : text
}

export async function regenerate(formData: FormData): Promise<void> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!weekStart.success) return

  await requireSession()

  try {
    await regenerateShoppingList(weekStart.data)
  } catch (error) {
    // A week with no menu has nothing to aggregate. The page only offers the
    // button when a menu exists, so this is a direct call or a race with
    // someone deleting the week; re-rendering shows the empty state again.
    if (!(error instanceof NoMenuError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function toggle(formData: FormData): Promise<void> {
  const id = ShoppingItemIdSchema.safeParse(formData.get("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!id.success || !weekStart.success) return

  // The identity comes from the session and never from the form: a client that
  // could name the ticker could tick as the other user.
  const session = await requireSession()

  try {
    await setItemChecked(
      id.data,
      session.userId,
      formData.get("checked") === "1"
    )
  } catch (error) {
    // The line went away under us — a regeneration between the render and the
    // tap. Re-rendering shows the list as it now is, which is the truth.
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function addItem(formData: FormData): Promise<void> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const input = ManualItemSchema.safeParse({
    name: formData.get("name"),
    aisle: formData.get("aisle") ?? "",
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
  })

  if (!weekStart.success || !input.success) return

  await requireSession()

  try {
    await addManualItem(weekStart.data, input.data)
  } catch (error) {
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function removeItem(formData: FormData): Promise<void> {
  const id = ShoppingItemIdSchema.safeParse(formData.get("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!id.success || !weekStart.success) return

  await requireSession()

  await removeManualItem(id.data)

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}
```

Every one of these returns `Promise<void>` because `<form action={…}>` requires that signature. None of them reports a validation failure to the user, and that is deliberate: each is driven by a control the page rendered from data it just read, so a failure means a direct call or a race, and re-rendering the truth is the right answer. The one form a person actually types into is the add form, whose only failure mode — an empty name — the submit button already prevents.

- [ ] **Step 2: Write the list component**

Create `components/shopping/shopping-list.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import {
  ShoppingItemRow,
  type ShoppingRow,
} from "@/components/shopping/shopping-item-row"

export type ShoppingGroup = { aisle: string; items: ShoppingRow[] }

// The other phone may be ticking items off at the same time. §6.3 settles the
// mechanism: refresh the server component, no JSON endpoint and no fetching
// library. Thirty seconds is slow enough to be invisible on a mobile connection
// and quick enough that two people in one shop do not duplicate a purchase.
const REFRESH_MS = 30_000

export function ShoppingList({
  groups,
  weekStart,
  toggleAction,
  removeAction,
}: {
  groups: ShoppingGroup[]
  weekStart: string
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      // Nothing to fetch for a screen nobody is looking at, and a phone in a
      // pocket must not poll.
      if (document.visibilityState === "visible") router.refresh()
    }

    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router])

  const withWeek = (action: (formData: FormData) => Promise<void>) => {
    return async (formData: FormData) => {
      formData.set("weekStart", weekStart)
      return action(formData)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.aisle} className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group.aisle}
          </h2>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                toggleAction={withWeek(toggleAction)}
                removeAction={withWeek(removeAction)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write the redirect entry point**

Create `app/(app)/spesa/page.tsx`:

```tsx
import { redirect } from "next/navigation"

import { weekStartFor } from "@/lib/week"

// Without this, Next would render the redirect at build time and bake in
// whichever week was current when the deploy happened.
export const dynamic = "force-dynamic"

export default function ShoppingPage() {
  const weekStart = weekStartFor(new Date())
  redirect(`/spesa/${weekStart.toISOString().slice(0, 10)}`)
}
```

- [ ] **Step 4: Write the two state files**

Create `app/(app)/spesa/[weekStart]/loading.tsx`:

```tsx
import { ListSkeleton } from "@/components/page/list-skeleton"

export default function Loading() {
  return <ListSkeleton label="Caricamento della lista…" rows={8} />
}
```

Create `app/(app)/spesa/[weekStart]/error.tsx`:

```tsx
"use client"

import { PageError } from "@/components/page/page-error"

// `"use client"` stays here even though PageError carries its own: Next
// requires an error boundary file to be a client component regardless.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError reset={reset} />
}
```

- [ ] **Step 5: Write the list page**

Create `app/(app)/spesa/[weekStart]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  addItem,
  regenerate,
  removeItem,
  toggle,
} from "@/app/(app)/spesa/[weekStart]/actions"
import { EmptyState } from "@/components/page/empty-state"
import { PageHeader } from "@/components/page/page-header"
import { AddItemForm } from "@/components/shopping/add-item-form"
import { ShoppingList } from "@/components/shopping/shopping-list"
import { Button } from "@/components/ui/button"
import { AISLE_ORDER } from "@/lib/aisles"
import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { listIngredientsWithAisle } from "@/lib/services/ingredients"
import { getShoppingList, groupByAisle } from "@/lib/services/shopping-lists"
import { dateForDay } from "@/lib/week"

export const metadata = { title: "Spesa" }

const iso = (date: Date) => date.toISOString().slice(0, 10)

const rangeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

export default async function ShoppingWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>
}) {
  const { weekStart: raw } = await params
  const parsed = WeekStartSchema.safeParse(raw)

  if (!parsed.success) notFound()

  const weekStart = parsed.data
  const [list, catalogue] = await Promise.all([
    getShoppingList(weekStart),
    listIngredientsWithAisle(),
  ])

  const week = iso(weekStart)
  const range = `${rangeFormat.format(weekStart)} – ${rangeFormat.format(
    dateForDay(weekStart, DAYS_IN_WEEK - 1)
  )}`

  return (
    <main className="flex flex-col gap-4 pt-6">
      <PageHeader title="Spesa" back={{ href: `/menu/${week}`, label: "Menù" }}>
        {list === null ? null : (
          <form action={regenerate}>
            <input type="hidden" name="weekStart" value={week} />
            <Button type="submit" variant="outline">
              Rigenera
            </Button>
          </form>
        )}
      </PageHeader>

      <p className="text-sm text-muted-foreground">{range}</p>

      {list === null ? (
        <EmptyState
          title="Nessuna lista per questa settimana."
          description="Si costruisce dal menù: le ricette che hai messo negli slot diventano righe, raggruppate per reparto."
        >
          <form action={regenerate}>
            <input type="hidden" name="weekStart" value={week} />
            <Button type="submit">Genera la lista</Button>
          </form>
        </EmptyState>
      ) : (
        <>
          {list.stale ? (
            <p
              role="status"
              className="rounded-md border border-input bg-muted px-3 py-2 text-sm"
            >
              Il menù è cambiato dopo questa lista. Rigenerala per allinearla —
              le spunte e le righe aggiunte a mano restano.
            </p>
          ) : null}

          {list.items.length === 0 ? (
            <EmptyState
              title="La lista è vuota."
              description="Il menù di questa settimana non ha ricette con ingredienti."
            >
              <Button
                variant="outline"
                render={<Link href={`/menu/${week}`} />}
                nativeButton={false}
              >
                Vai al menù
              </Button>
            </EmptyState>
          ) : (
            <ShoppingList
              groups={groupByAisle(list.items)}
              weekStart={week}
              toggleAction={toggle}
              removeAction={removeItem}
            />
          )}

          <AddItemForm
            weekStart={week}
            catalogue={catalogue}
            aisles={AISLE_ORDER}
            action={addItem}
          />
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Add the navigation entry and the link from the menu**

In `components/app-sidebar.tsx`, extend the import and add the entry after "Menù":

```tsx
import { BookOpen, CalendarDays, Carrot, ShoppingCart } from "lucide-react"
```

```tsx
const NAV_ITEMS = [
  { href: "/menu", label: "Menù", icon: CalendarDays },
  { href: "/spesa", label: "Spesa", icon: ShoppingCart },
  { href: "/recipes", label: "Ricettario", icon: BookOpen },
  { href: "/ingredients", label: "Ingredienti", icon: Carrot },
] as const
```

In `app/(app)/menu/[weekStart]/page.tsx`, add a third control to the `PageHeader`, before the two arrows:

```tsx
<Button
  variant="outline"
  render={<Link href={`/spesa/${iso(weekStart)}`} />}
  nativeButton={false}
>
  Spesa
</Button>
```

- [ ] **Step 7: Verify**

```powershell
pnpm verify
```

Expected: green.

- [x] **Step 8: Manual browser check**

At 390px, with `pnpm dev` running. It can be executed by an agent through the `playwright` MCP server.

1. The side menu shows "Spesa" after "Menù", and it highlights on `/spesa/2026-08-17`.
2. `/spesa` lands on the current week. With no list yet: the empty state and "Genera la lista".
3. Put two recipes into the menu that share an ingredient, then generate. That ingredient appears **once**, with the summed quantity, under its aisle heading. Aisles run in walking order, not alphabetically, and "altro" is last.
4. Tick a line — it strikes through **immediately**, before the request finishes. Reload: it is still ticked.
5. Add "detersivo" by hand: it is not in the catalogue, so the aisle stays "altro" and the unit empty. It appears with a delete button.
6. Add "mele": picking it from the catalogue fills the aisle to `ortofrutta` and the unit to whatever the catalogue holds, without touching either field.
7. Delete "detersivo" — gone. A generated line has no delete button at all.
8. Go to the menu, change a slot, come back: the "Il menù è cambiato" banner is there. Rigenera — the banner goes, the ticks survive, and "detersivo" is still on the list.
9. Tick a line, then raise that ingredient's quantity by adding another recipe using it, and regenerate: that line comes back **unticked**. A line whose quantity did not rise keeps its tick.
10. Open the same list in a second browser window, tick something in one, and within thirty seconds the other shows it without a manual reload.
11. `/spesa/2026-08-19` — not a Monday — renders the 404 page.

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: shop from the weekly menu"
```

---

## Task 6: Design review and documentation

**Files:**

- Modify: whatever the review finds
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run the guidelines**

Use `.agents/skills/web-design-guidelines/` over:

```
components/shopping/shopping-list.tsx
components/shopping/shopping-item-row.tsx
components/shopping/add-item-form.tsx
app/(app)/spesa/[weekStart]/page.tsx
components/app-sidebar.tsx
```

- [ ] **Step 2: Triage**

Fix focus order, keyboard reachability, labels, live regions, contrast, heading structure, long-content overflow. Three to check explicitly:

- **The checkbox and its label share one hit target.** The guidelines require it and a shopping list is the screen where it matters most — a thumb, one hand, a moving trolley. The `htmlFor` in `ShoppingItemRow` gives it; confirm the label really is clickable across its whole width.
- **`tabular-nums` on the quantities.** Already applied in the row. Leave it: a column of quantities that jitters is the case the rule exists for.
- **The stale banner is a `role="status"`, not an `alert`.** It is information, not an error, and it is present on first render rather than appearing later — do not "upgrade" it to `role="alert"`.

**Dismiss any finding about control or touch-target size**, naming the decision in `docs/conventions/ui.md` under "Touch targets". Do not edit `components/ui/`.

- [ ] **Step 3: Move the roadmap row**

In `docs/roadmap.md`, delete the shopping-list section from "Not started", renumber the sections that follow, and add to the "Shipped" table:

```markdown
| [`2026-08-14-shopping-list`](superpowers/plans/2026-08-14-shopping-list.md) | `/spesa/[weekStart]`, the aisle-grouped list, optimistic ticking, manual items, and the freshness signal over `Menu.slotsUpdatedAt` |
```

Then note in the remaining text that the product loop — plan a week, shop from it — is closed, and what is left is the LLM half, authentication and deployment.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm verify
git add -A
git commit -m "fix: address the design review of the shopping list"
```

---

## Out of scope, deliberately

- **Any change to `aggregateShoppingList`.** It is pure, tested and correct. If a behaviour here looks wrong, the fault is in what this module feeds it or stores from it.
- **Merging a manual line into a generated one.** Decided against — see the top of this plan.
- **Showing who ticked a line.** The columns are written; no screen reads them.
- **Server-sent events.** §6.3 names them a v2 upgrade if the focus-plus-interval refresh proves insufficient. It has not been tried yet.
- **A printable or shareable list.** Nobody has asked.
- **Editing a manual line after adding it.** Delete it and add it again; it is four words.
