# Weekly Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A week of fourteen meal slots, editable entirely by hand, so the product loop finally has something for the shopping list to aggregate.

**Architecture:** A third module under `app/(app)/menu/`, built from the same page primitives as the other two. `/menu` redirects to the current week; `/menu/[weekStart]` renders seven day blocks of two slots each. A slot opens a bottom drawer holding a recipe picker, a free-text field, a servings override and a clear button. The database stores only the slots that have content; the fourteen-cell grid is built by a pure function, which is the one piece of logic here worth a test.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`base-mira` / `mist`).

**Spec:** `docs/superpowers/specs/2026-08-13-menu-spesa-design.md` — §6.2 (the flow), §5 and its design notes (`MenuSlot` is a three-state cell; `servings` is an exception), §12 items 3 and 4 (week boundary, servings default), §4.3 (UI rules).

## What this plan deliberately does not build

Settled with the owner on 2026-08-14, before writing:

- **No LLM.** No `lib/services/llm.ts`, no `proposeMenu`, no regeneration. That is the next plan. Spec §8 requires every LLM-assisted path to have a working manual equivalent, so the hand-built grid is not a stepping stone towards generation — it is the floor generation stands on, and it has to exist first.
- **No shopping list.** It aggregates from this grid and is the plan after next.
- **No moving a recipe between slots.** §6.2 lists "move a recipe between slots" among the editing freedoms. The owner does not want it: with fourteen slots and a one-week horizon, moving costs three retyped letters in a picker that filters as you type. Reassigning the destination and clearing the source achieves the same thing with no cross-slot operation, no collision rule and no extra screen. Do not add it back.
- **No week list screen.** Previous and next arrows, nothing else.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited. Control sizing is whatever the registry generates.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; add `nativeButton={false}` when `render` yields a non-button **and** the component wraps the Base UI Button primitive.
- **Use the page primitives.** `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton`, `DetailSkeleton` in `components/page/`. Do not rebuild them and do not add a boolean prop to one. See `docs/conventions/ui.md`.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth` — `lib/config` and `lib/week` are leaf modules and are allowed. `lib/schemas/**` imports **Zod and nothing else**. ESLint fails the build.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws`. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads**, including every Zod message. English for identifiers, comments, TSDoc, commit messages.
- **Dates.** `Menu.weekStart` is a Postgres `date`. Which week a moment falls in is decided in `APP_TIMEZONE`, never the server's timezone. `MenuSlot.day` is `0 = Monday … 6 = Sunday`, which is **not** `Date.getDay()`. All of it lives in `lib/week.ts` and is already written and tested — call it, do not reimplement it.
- **Dates and numbers are formatted with `Intl.*`**, never with a hardcoded format string.
- **Phone first at 390px.** Theme tokens only, no hex, no raw palette classes.
- **`pnpm verify` is the gate.**

## Testing

Per `docs/conventions/testing.md`, which binds over this skill's test-first default: the Zod schemas and the pure grid builder are tested; the React components are not — `vitest.config.ts` runs `environment: "node"` with no DOM, and the convention excludes presentational code. Component tasks verify with `pnpm verify` plus a written manual browser check.

## Two environment notes

**The shell.** If a command fails with `"node" non è riconosciuto`, the Git Bash PATH carries a broken `app.asar` entry. Run `pnpm` and `git` through PowerShell instead, and strip the entry for the commit, in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
git commit -m "…"
```

Never `--no-verify`.

**No migration.** `Menu`, `MenuSlot` and `MealType` already exist, created by `20260813155231_init_menu_and_shopping`. Nothing in this plan touches `prisma/schema.prisma`. If you find yourself writing a migration, stop — you have misread the model.

---

## File Structure

**Created**

| File                                     | Responsibility                                          |
| ---------------------------------------- | ------------------------------------------------------- |
| `lib/schemas/menu.ts`                    | the week, day, meal and slot contracts                  |
| `lib/schemas/menu.test.ts`               | covers them                                             |
| `lib/services/menus.ts`                  | `getMenuWeek`, `setSlot`, `clearSlot`, `buildWeekSlots` |
| `lib/services/menus.test.ts`             | covers `buildWeekSlots` only                            |
| `components/menu/recipe-picker.tsx`      | the filter-as-you-type recipe combobox                  |
| `components/menu/slot-drawer.tsx`        | the bottom drawer that edits one slot                   |
| `components/menu/day-block.tsx`          | one day, two slot buttons                               |
| `components/menu/week-grid.tsx`          | the seven blocks and the one open drawer                |
| `app/(app)/menu/page.tsx`                | redirects to the current week                           |
| `app/(app)/menu/[weekStart]/page.tsx`    | the grid                                                |
| `app/(app)/menu/[weekStart]/actions.ts`  | `saveSlot`, `emptySlot`                                 |
| `app/(app)/menu/[weekStart]/loading.tsx` | delegates to `ListSkeleton`                             |
| `app/(app)/menu/[weekStart]/error.tsx`   | delegates to `PageError`                                |

**Modified**

| File                                                     | Change                                       |
| -------------------------------------------------------- | -------------------------------------------- |
| `components/app-sidebar.tsx`                             | one entry in `NAV_ITEMS`, first              |
| `docs/superpowers/specs/2026-08-13-menu-spesa-design.md` | §6.2 records `combobox` instead of `command` |
| `docs/roadmap.md`                                        | the menu row moves out of "Not started"      |

---

## Task 1: The contracts

**Files:**

- Create: `lib/schemas/menu.ts`
- Create: `lib/schemas/menu.test.ts`

**Interfaces:**

- Consumes: Zod, and nothing else. This is enforced.
- Produces:
  - `MEAL_TYPES` — `readonly ["LUNCH", "DINNER"]`
  - `MealSchema`, `type Meal`
  - `DaySchema`
  - `WeekStartSchema` → `Date`
  - `SlotInputSchema` → `{ recipeId: string | null; freeText: string | null; servings: number | null }`
  - `type SlotInput`

**Why the week is validated down to "it must be a Monday".** The URL carries the week as its Monday: `/menu/2026-08-17`. If `/menu/2026-08-19` were accepted, two URLs would name the same week, `db.menu.upsert({ where: { weekStart } })` would create a second row for it, and `Menu.weekStart @unique` would not stop it because the two dates genuinely differ. One rule in the schema removes the whole class.

**Why a slot may not hold both a recipe and a note.** The shopping list reads the recipe and ignores the note (§6.3 step 1). A slot carrying both would quietly shop for a meal the note says you are eating out.

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/menu.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  DaySchema,
  MealSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"

describe("WeekStartSchema", () => {
  it("accepts a Monday and returns it as a date", () => {
    const result = WeekStartSchema.parse("2026-08-17")
    expect(result.toISOString()).toBe("2026-08-17T00:00:00.000Z")
  })

  it("rejects a day that is not a Monday, so one week cannot have two URLs", () => {
    const result = WeekStartSchema.safeParse("2026-08-19")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "La settimana deve iniziare di lunedì."
      )
    }
  })

  it("rejects a date that does not exist", () => {
    expect(WeekStartSchema.safeParse("2026-02-31").success).toBe(false)
  })

  it("rejects anything that is not a plain AAAA-MM-GG date", () => {
    expect(WeekStartSchema.safeParse("2026-08-17T00:00:00Z").success).toBe(
      false
    )
  })
})

describe("DaySchema", () => {
  it("accepts Monday as zero and Sunday as six", () => {
    expect(DaySchema.parse(0)).toBe(0)
    expect(DaySchema.parse(6)).toBe(6)
  })

  it("rejects a seventh day", () => {
    expect(DaySchema.safeParse(7).success).toBe(false)
  })

  it("rejects a fraction", () => {
    expect(DaySchema.safeParse(1.5).success).toBe(false)
  })
})

describe("MealSchema", () => {
  it("accepts the two meals", () => {
    expect(MealSchema.parse("LUNCH")).toBe("LUNCH")
    expect(MealSchema.parse("DINNER")).toBe("DINNER")
  })

  it("rejects anything else", () => {
    expect(MealSchema.safeParse("BREAKFAST").success).toBe(false)
  })
})

describe("SlotInputSchema", () => {
  const empty = { recipeId: null, freeText: null, servings: null }

  it("accepts an empty slot", () => {
    expect(SlotInputSchema.parse(empty)).toEqual(empty)
  })

  it("accepts a slot holding a recipe", () => {
    const parsed = SlotInputSchema.parse({
      ...empty,
      recipeId: "cm3xk1p2h0000abcdefghijkl",
    })
    expect(parsed.recipeId).toBe("cm3xk1p2h0000abcdefghijkl")
  })

  it("accepts a slot holding a note", () => {
    expect(
      SlotInputSchema.parse({ ...empty, freeText: "fuori a cena" }).freeText
    ).toBe("fuori a cena")
  })

  it("turns a blank note into null, so it is absent rather than empty", () => {
    expect(
      SlotInputSchema.parse({ ...empty, freeText: "  " }).freeText
    ).toBeNull()
  })

  it("rejects a slot holding both a recipe and a note", () => {
    const result = SlotInputSchema.safeParse({
      recipeId: "cm3xk1p2h0000abcdefghijkl",
      freeText: "fuori a cena",
      servings: null,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Uno slot può contenere una ricetta oppure una nota, non entrambe."
      )
    }
  })

  it("rejects zero servings, which would cook for nobody", () => {
    expect(SlotInputSchema.safeParse({ ...empty, servings: 0 }).success).toBe(
      false
    )
  })

  it("rejects a recipe id that is not a cuid", () => {
    expect(
      SlotInputSchema.safeParse({ ...empty, recipeId: "42" }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```powershell
pnpm exec vitest run lib/schemas/menu.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the schemas**

Create `lib/schemas/menu.ts`:

```ts
import { z } from "zod"

export const FREE_TEXT_MAX = 80
export const SERVINGS_MAX = 20

export const MEAL_TYPES = ["LUNCH", "DINNER"] as const

// No custom message: the meal is a hidden field the user never types, so the
// only way to fail this is to call the action directly.
export const MealSchema = z.enum(MEAL_TYPES)
export type Meal = z.infer<typeof MealSchema>

export const DaySchema = z
  .number("Il giorno deve essere un numero.")
  .int("Il giorno deve essere un numero intero.")
  .min(0, "Il giorno non può venire prima di lunedì.")
  .max(6, "Il giorno non può venire dopo domenica.")

export const WeekStartSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La settimana deve essere una data AAAA-MM-GG.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "Questa data non esiste.")
  // A week is named by its Monday. Accepting any other day would let two URLs
  // mean one week, and `Menu.weekStart @unique` cannot catch that because the
  // two dates really are different.
  .refine(
    (date) => date.getUTCDay() === 1,
    "La settimana deve iniziare di lunedì."
  )

export const SlotInputSchema = z
  .object({
    recipeId: z.cuid("Questa ricetta non è valida.").nullable(),
    // An empty note is absent, not blank — the same rule the ingredient unit
    // follows, so a slot never holds an empty string nobody can see.
    freeText: z
      .string()
      .trim()
      .max(
        FREE_TEXT_MAX,
        `La nota può avere al massimo ${FREE_TEXT_MAX} caratteri.`
      )
      .nullable()
      .transform((value) => (value === null || value === "" ? null : value)),
    servings: z
      .number("Le porzioni devono essere un numero.")
      .int("Le porzioni devono essere un numero intero.")
      .positive("Le porzioni devono essere più di zero.")
      .max(SERVINGS_MAX, `Le porzioni non possono superare ${SERVINGS_MAX}.`)
      .nullable(),
  })
  // The shopping list reads the recipe and ignores the note, so a slot holding
  // both would shop for a meal the note says you are not cooking.
  .refine((slot) => slot.recipeId === null || slot.freeText === null, {
    message:
      "Uno slot può contenere una ricetta oppure una nota, non entrambe.",
    path: ["freeText"],
  })

export type SlotInput = z.infer<typeof SlotInputSchema>
```

- [ ] **Step 4: Run them and watch them pass**

```powershell
pnpm exec vitest run lib/schemas/menu.test.ts
```

Expected: 15 passed.

- [ ] **Step 5: Verify**

```powershell
pnpm verify
```

Expected: green, 133 tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/schemas
git commit -m "feat: add the weekly menu contracts"
```

---

## Task 2: The service

**Files:**

- Create: `lib/services/menus.ts`
- Create: `lib/services/menus.test.ts`

**Interfaces:**

- Consumes: `MEAL_TYPES`, `Meal`, `SlotInput` from Task 1; `DAYS_IN_WEEK` from `@/lib/config`; `db` from `@/lib/db`.
- Produces:
  - `type MenuSlotView = { day: number; meal: Meal; recipeId: string | null; recipeTitle: string | null; freeText: string | null; servings: number | null }`
  - `buildWeekSlots(stored: readonly MenuSlotView[]): MenuSlotView[]` — always fourteen
  - `getMenuWeek(weekStart: Date): Promise<MenuSlotView[]>`
  - `setSlot(weekStart: Date, day: number, meal: Meal, input: SlotInput): Promise<void>`
  - `clearSlot(weekStart: Date, day: number, meal: Meal): Promise<void>`
  - `class UnknownRecipeError`

**Why the grid is built rather than stored.** The database holds only the slots that have content — an untouched week has no `Menu` row at all. The screen always shows fourteen cells. Turning the sparse set into the dense grid is the only logic in this module that does not need a database, so it is a pure exported function with its own test, exactly as `isKnownAisle` and `rankUnitsByUse` already are.

**Why the `Menu` row is created lazily.** Browsing six weeks ahead must not leave six empty rows behind. `setSlot` upserts the menu with `update: {}` — create it if it is missing, otherwise leave it exactly as it is.

- [ ] **Step 1: Write the failing test**

Create `lib/services/menus.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildWeekSlots, type MenuSlotView } from "@/lib/services/menus"

const stored = (over: Partial<MenuSlotView>): MenuSlotView => ({
  day: 0,
  meal: "LUNCH",
  recipeId: null,
  recipeTitle: null,
  freeText: null,
  servings: null,
  ...over,
})

describe("buildWeekSlots", () => {
  it("always returns fourteen slots, even for an untouched week", () => {
    expect(buildWeekSlots([])).toHaveLength(14)
  })

  it("orders them day by day, lunch before dinner", () => {
    const slots = buildWeekSlots([])
    expect(slots.slice(0, 3).map((slot) => [slot.day, slot.meal])).toEqual([
      [0, "LUNCH"],
      [0, "DINNER"],
      [1, "LUNCH"],
    ])
    expect(slots[13]).toMatchObject({ day: 6, meal: "DINNER" })
  })

  it("puts a stored slot in its own place and leaves the rest empty", () => {
    const slots = buildWeekSlots([
      stored({ day: 2, meal: "DINNER", recipeId: "abc", recipeTitle: "Ragù" }),
    ])

    expect(slots.find((s) => s.day === 2 && s.meal === "DINNER")).toMatchObject(
      {
        recipeId: "abc",
        recipeTitle: "Ragù",
      }
    )
    expect(slots.filter((s) => s.recipeId !== null)).toHaveLength(1)
  })

  it("keeps a free-text slot as text, with no recipe", () => {
    const slots = buildWeekSlots([
      stored({ day: 5, meal: "DINNER", freeText: "fuori a cena" }),
    ])

    expect(slots.find((s) => s.day === 5 && s.meal === "DINNER")).toMatchObject(
      {
        freeText: "fuori a cena",
        recipeId: null,
      }
    )
  })

  it("drops a row outside the week rather than growing the grid", () => {
    // Nothing in the database constrains `day` to 0..6, so a bad row must not
    // reach the screen as an eighth day.
    expect(buildWeekSlots([stored({ day: 9 })])).toHaveLength(14)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```powershell
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the service**

Create `lib/services/menus.ts`:

```ts
import { DAYS_IN_WEEK } from "@/lib/config"
import { db } from "@/lib/db"
import { MEAL_TYPES, type Meal, type SlotInput } from "@/lib/schemas/menu"

/** Thrown when a slot names a recipe that is no longer in the database. */
export class UnknownRecipeError extends Error {
  constructor() {
    super("No recipe with this id.")
    this.name = "UnknownRecipeError"
  }
}

export type MenuSlotView = {
  day: number
  meal: Meal
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

// Prisma's foreign-key failure (P2003), read structurally so this module never
// imports a Prisma type outside lib/db.ts.
function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  )
}

const keyOf = (day: number, meal: Meal) => `${day}-${meal}`

/**
 * Expands the stored slots into the fourteen the screen always shows.
 *
 * Exported for its own test: the database holds only the slots that have
 * content, so this is where a sparse week becomes a dense grid, and it is the
 * one piece of logic here that needs no database.
 *
 * @param stored The slots that exist, in any order.
 * @returns Fourteen slots, day 0 to 6, lunch before dinner.
 */
export function buildWeekSlots(
  stored: readonly MenuSlotView[]
): MenuSlotView[] {
  const byKey = new Map(
    stored.map((slot) => [keyOf(slot.day, slot.meal), slot])
  )

  return Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    MEAL_TYPES.map(
      (meal): MenuSlotView =>
        byKey.get(keyOf(day, meal)) ?? {
          day,
          meal,
          recipeId: null,
          recipeTitle: null,
          freeText: null,
          servings: null,
        }
    )
  ).flat()
}

/**
 * Reads one week as fourteen slots.
 *
 * A week nobody has touched has no `Menu` row at all; it comes back as fourteen
 * empty slots rather than as an error, because an empty week is a normal state.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns Fourteen slots, day 0 to 6, lunch before dinner.
 */
export async function getMenuWeek(weekStart: Date): Promise<MenuSlotView[]> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slots: {
        select: {
          day: true,
          meal: true,
          recipeId: true,
          freeText: true,
          servings: true,
          recipe: { select: { title: true } },
        },
      },
    },
  })

  return buildWeekSlots(
    (menu?.slots ?? []).map(({ recipe, ...slot }) => ({
      ...slot,
      recipeTitle: recipe?.title ?? null,
    }))
  )
}

/**
 * Writes one slot, creating the week the first time anything is saved into it.
 *
 * The `Menu` row is upserted with an empty update: browsing forward must not
 * leave a trail of empty weeks, so the row appears only when it earns one.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param day 0 for Monday through 6 for Sunday.
 * @param meal Which of the day's two meals.
 * @param input The validated slot contents.
 * @returns Nothing.
 * @throws UnknownRecipeError When the recipe was deleted between the picker and the save.
 */
export async function setSlot(
  weekStart: Date,
  day: number,
  meal: Meal,
  input: SlotInput
): Promise<void> {
  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    update: {},
    select: { id: true },
  })

  try {
    await db.menuSlot.upsert({
      where: { menuId_day_meal: { menuId: menu.id, day, meal } },
      create: { menuId: menu.id, day, meal, ...input },
      update: input,
    })
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}

/**
 * Empties one slot.
 *
 * Deleting the row rather than blanking its columns: an empty slot and an
 * absent slot must mean the same thing, and `buildWeekSlots` already makes them
 * look identical on screen. Uses `deleteMany` so clearing an already-empty slot
 * is not an error.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param day 0 for Monday through 6 for Sunday.
 * @param meal Which of the day's two meals.
 * @returns Nothing.
 */
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

  await db.menuSlot.deleteMany({ where: { menuId: menu.id, day, meal } })
}
```

- [ ] **Step 4: Run the tests**

```powershell
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Verify**

```powershell
pnpm verify
```

Expected: green, 138 tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/services
git commit -m "feat: add the weekly menu service"
```

---

## Task 3: The picker and the drawer

**Files:**

- Create: `components/menu/recipe-picker.tsx`
- Create: `components/menu/slot-drawer.tsx`

**Interfaces:**

- Consumes: nothing at compile time from the services — both take their data as props.
- Produces:
  - `type RecipeOption = { id: string; title: string }`
  - `RecipePicker({ recipes, value, onSelect, "aria-label" })`
  - `type SlotFormState = { message: string | null; ok: boolean }`
  - `type SaveSlotAction = (state: SlotFormState, formData: FormData) => Promise<SlotFormState>`
  - `EMPTY_SLOT_FORM_STATE`
  - `SlotDrawer({ open, onClose, slot, weekStart, dayLabel, recipes, saveAction, clearAction })`

**Why `combobox` and not `command`.** §6.2 of the spec says "search via the shadcn `command` palette". This plan uses `combobox` instead, decided with the owner on 2026-08-14: it is already installed, `components/ingredients/ingredient-picker.tsx` already uses it for exactly this filter-as-you-type gesture, and introducing `command` would give the app two different search interactions for the same action. Task 5 updates the spec to say so. Do not "restore" `command`.

**The reset trap, again.** React 19 calls `requestFormReset` before an action runs, unconditionally. The recipe and ingredient forms solve it by echoing submitted values back through the action state. This drawer does not need that treatment, and here is why, so nobody adds it by cargo cult: the drawer closes on success and is re-rendered from fresh server data on failure it stays open showing `state.message`, and its only free-typed fields are the note and the servings, which a user retypes in two seconds. If that proves annoying, echo the values the way `components/recipes/recipe-form-state.ts` does — do not invent a third pattern.

- [ ] **Step 1: Read the installed combobox API before writing against it**

```powershell
Get-Content components/ui/combobox.tsx | Select-String -Pattern 'itemToStringLabel|isItemEqualToValue|^export \{' -Context 0,12
```

`components/ingredients/ingredient-picker.tsx` carries a comment explaining that it deals in plain strings precisely so that Base UI needs **neither** `itemToStringLabel` **nor** `isItemEqualToValue`. This picker cannot do that: two recipes may share a title, so the value has to be the object carrying the id.

If the installed component does not accept `itemToStringLabel`, **stop and report it** rather than guessing — the fallback is to key the combobox on the id string and look the title up in a `Map`, but take that decision explicitly.

- [ ] **Step 2: Write the picker**

Create `components/menu/recipe-picker.tsx`:

```tsx
"use client"

import { useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export type RecipeOption = { id: string; title: string }

// Unlike the ingredient picker, this one carries objects rather than plain
// strings: two recipes may share a title, so the title cannot identify the row.
export function RecipePicker({
  recipes,
  value,
  onSelect,
  "aria-label": ariaLabel,
}: {
  recipes: RecipeOption[]
  value: RecipeOption | null
  onSelect: (recipe: RecipeOption) => void
  "aria-label": string
}) {
  const [query, setQuery] = useState("")

  return (
    <Combobox
      // Off: a recipe is not a field a password manager has any business
      // completing.
      autoComplete="off"
      items={recipes}
      itemToStringLabel={(recipe: RecipeOption) => recipe.title}
      isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
      value={value}
      onValueChange={(recipe: RecipeOption | null) => {
        if (recipe !== null) onSelect(recipe)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxInput aria-label={ariaLabel} placeholder="Cerca una ricetta" />
      <ComboboxContent>
        <ComboboxEmpty>Nessuna ricetta con questo nome.</ComboboxEmpty>
        <ComboboxList>
          {(recipe: RecipeOption) => (
            <ComboboxItem key={recipe.id} value={recipe}>
              {recipe.title}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

- [ ] **Step 3: Write the drawer**

Create `components/menu/slot-drawer.tsx`:

```tsx
"use client"

import { useActionState, useEffect, useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { Button } from "@/components/ui/button"
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

export type SlotFormState = { message: string | null; ok: boolean }

export type SaveSlotAction = (
  state: SlotFormState,
  formData: FormData
) => Promise<SlotFormState>

export const EMPTY_SLOT_FORM_STATE: SlotFormState = { message: null, ok: false }

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

export function SlotDrawer({
  open,
  onClose,
  slot,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
  clearAction,
}: {
  open: boolean
  // Must be a stable reference — see the effect below. The parent creates it
  // with useCallback.
  onClose: () => void
  slot: SlotDrawerValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: SaveSlotAction
  clearAction: (formData: FormData) => Promise<void>
}) {
  const [state, formAction, isPending] = useActionState(
    saveAction,
    EMPTY_SLOT_FORM_STATE
  )
  const [picked, setPicked] = useState<RecipeOption | null>(
    slot.recipeId === null || slot.recipeTitle === null
      ? null
      : { id: slot.recipeId, title: slot.recipeTitle }
  )

  // useActionState hands back a fresh object on every submit, so this fires
  // once per successful save and not again when the drawer is reopened —
  // provided `onClose` keeps its identity between renders.
  useEffect(() => {
    if (state.ok) onClose()
  }, [state, onClose])

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {dayLabel} · {mealLabel}
          </DrawerTitle>
          <DrawerDescription>
            Scegli una ricetta, oppure scrivi una nota per un pasto che non si
            cucina.
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="day" value={slot.day} />
          <input type="hidden" name="meal" value={slot.meal} />
          <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="recipe">Ricetta</FieldLabel>
              <RecipePicker
                recipes={recipes}
                value={picked}
                onSelect={setPicked}
                aria-label="Ricetta"
              />
              <FieldDescription>
                Scrivi per filtrare il ricettario.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="freeText">Oppure una nota</FieldLabel>
              <Input
                id="freeText"
                name="freeText"
                defaultValue={slot.freeText ?? ""}
                autoComplete="off"
                placeholder="fuori a cena…"
              />
              <FieldDescription>
                Una nota non finisce nella lista della spesa.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="servings">Porzioni</FieldLabel>
              <Input
                id="servings"
                name="servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                defaultValue={slot.servings ?? ""}
                autoComplete="off"
              />
              <FieldDescription>
                Lascia vuoto per le porzioni di casa.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvo…" : "Salva"}
            </Button>
          </DrawerFooter>
        </form>

        {/* A second form, a sibling and not a child: a form inside a form is
            invalid HTML and the browser drops the inner one. */}
        <form action={clearAction} className="px-4 pb-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="day" value={slot.day} />
          <input type="hidden" name="meal" value={slot.meal} />
          <Button type="submit" variant="outline" className="w-full">
            Svuota
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 4: Verify**

```powershell
pnpm verify
```

Expected: green. Nothing renders these yet, so this only proves they compile and lint.

- [ ] **Step 5: Commit**

```powershell
git add components/menu
git commit -m "feat: add the menu slot picker and drawer"
```

---

## Task 4: The screens

**Files:**

- Create: `app/(app)/menu/page.tsx`
- Create: `app/(app)/menu/[weekStart]/page.tsx`
- Create: `app/(app)/menu/[weekStart]/actions.ts`
- Create: `app/(app)/menu/[weekStart]/loading.tsx`
- Create: `app/(app)/menu/[weekStart]/error.tsx`
- Create: `components/menu/day-block.tsx`
- Create: `components/menu/week-grid.tsx`
- Modify: `components/app-sidebar.tsx`

**Interfaces:**

- Consumes: everything from Tasks 1–3, plus `PageHeader` and `PageError` from `components/page/`, `listRecipes` from `@/lib/services/recipes`, and `weekStartFor` / `dayIndexFor` / `dateForDay` from `@/lib/week`.
- Produces: the `/menu` routes.

- [ ] **Step 1: Write the actions**

Create `app/(app)/menu/[weekStart]/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"

import type { SlotFormState } from "@/components/menu/slot-drawer"
import { requireSession } from "@/lib/auth"
import {
  DaySchema,
  MealSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
import { clearSlot, setSlot, UnknownRecipeError } from "@/lib/services/menus"

const iso = (date: Date) => date.toISOString().slice(0, 10)

// An empty numeric or text field arrives as "", which is not an absent value
// to Zod. The same helper shape app/(app)/recipes/actions.ts already uses.
function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : Number(text)
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : ""
  return text.trim() === "" ? null : text
}

// The three fields that address the slot, parsed together: none of them is
// meaningful without the others.
function addressFrom(formData: FormData) {
  return {
    weekStart: WeekStartSchema.safeParse(formData.get("weekStart")),
    day: DaySchema.safeParse(optionalNumber(formData.get("day"))),
    meal: MealSchema.safeParse(formData.get("meal")),
  }
}

export async function saveSlot(
  _state: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const address = addressFrom(formData)
  const input = SlotInputSchema.safeParse({
    recipeId: optionalText(formData.get("recipeId")),
    freeText: optionalText(formData.get("freeText")),
    servings: optionalNumber(formData.get("servings")),
  })

  if (
    !address.weekStart.success ||
    !address.day.success ||
    !address.meal.success
  ) {
    return { message: "Questo slot non esiste.", ok: false }
  }

  if (!input.success) {
    return { message: input.error.issues[0].message, ok: false }
  }

  await requireSession()

  try {
    await setSlot(
      address.weekStart.data,
      address.day.data,
      address.meal.data,
      input.data
    )
  } catch (error) {
    if (error instanceof UnknownRecipeError) {
      return { message: "Questa ricetta non esiste più.", ok: false }
    }
    throw error
  }

  // No redirect: the drawer closes on `ok` and the grid re-renders in place.
  // Redirecting would throw away the scroll position on a page that is two and
  // a half screens tall. The path is built from the validated date, never from
  // the raw field — that string reaches the cache key.
  revalidatePath(`/menu/${iso(address.weekStart.data)}`)
  return { message: null, ok: true }
}

export async function emptySlot(formData: FormData): Promise<void> {
  const address = addressFrom(formData)

  if (
    !address.weekStart.success ||
    !address.day.success ||
    !address.meal.success
  ) {
    return
  }

  await requireSession()

  await clearSlot(address.weekStart.data, address.day.data, address.meal.data)

  revalidatePath(`/menu/${iso(address.weekStart.data)}`)
}
```

`emptySlot` returns `Promise<void>` because `<form action={…}>` requires exactly that signature, and nothing would read a returned value.

- [ ] **Step 2: Write the day block**

Create `components/menu/day-block.tsx`:

```tsx
import { Card } from "@/components/ui/card"
import type { SlotDrawerValues } from "@/components/menu/slot-drawer"

function SlotButton({
  slot,
  onOpen,
}: {
  slot: SlotDrawerValues
  onOpen: () => void
}) {
  const label = slot.meal === "LUNCH" ? "Pranzo" : "Cena"
  const content = slot.recipeTitle ?? slot.freeText

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {content === null ? (
        <span className="text-sm text-muted-foreground">Vuoto</span>
      ) : (
        <span
          className={
            slot.recipeTitle === null
              ? "text-sm break-words text-muted-foreground italic"
              : "text-sm font-medium break-words"
          }
        >
          {content}
        </span>
      )}
    </button>
  )
}

export function DayBlock({
  label,
  isToday,
  slots,
  onOpen,
}: {
  label: string
  isToday: boolean
  slots: SlotDrawerValues[]
  onOpen: (slot: SlotDrawerValues) => void
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2
        className={
          isToday
            ? "px-1 text-sm font-semibold text-foreground"
            : "px-1 text-sm font-medium text-muted-foreground"
        }
      >
        {label}
        {isToday ? <span className="sr-only"> — oggi</span> : null}
      </h2>
      <Card className="gap-0 p-1">
        {slots.map((slot) => (
          <SlotButton key={slot.meal} slot={slot} onOpen={() => onOpen(slot)} />
        ))}
      </Card>
    </section>
  )
}
```

- [ ] **Step 3: Write the grid**

Create `components/menu/week-grid.tsx`:

```tsx
"use client"

import { useCallback, useState } from "react"

import { DayBlock } from "@/components/menu/day-block"
import type { RecipeOption } from "@/components/menu/recipe-picker"
import {
  SlotDrawer,
  type SaveSlotAction,
  type SlotDrawerValues,
} from "@/components/menu/slot-drawer"

const keyOf = (slot: SlotDrawerValues) => `${slot.day}-${slot.meal}`

// One drawer for the whole week rather than one per slot: the recipe list
// would otherwise be serialised into the payload fourteen times.
export function WeekGrid({
  weekStart,
  slots,
  dayLabels,
  todayIndex,
  recipes,
  saveAction,
  clearAction,
}: {
  weekStart: string
  slots: SlotDrawerValues[]
  dayLabels: string[]
  // -1 when the week on screen is not the current one.
  todayIndex: number
  recipes: RecipeOption[]
  saveAction: SaveSlotAction
  clearAction: (formData: FormData) => Promise<void>
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Stable across renders, so the drawer's close-on-success effect does not
  // refire and shut the drawer the moment it is reopened.
  const close = useCallback(() => setOpenKey(null), [])

  const open = slots.find((slot) => keyOf(slot) === openKey) ?? null

  return (
    <div className="flex flex-col gap-4">
      {dayLabels.map((label, day) => (
        <DayBlock
          key={day}
          label={label}
          isToday={day === todayIndex}
          slots={slots.filter((slot) => slot.day === day)}
          onOpen={(slot) => setOpenKey(keyOf(slot))}
        />
      ))}

      {open === null ? null : (
        <SlotDrawer
          // Remounts when the slot changes, so the drawer's local picker state
          // never carries one slot's recipe into the next one.
          key={keyOf(open)}
          open={true}
          onClose={close}
          slot={open}
          weekStart={weekStart}
          dayLabel={dayLabels[open.day]}
          recipes={recipes}
          saveAction={saveAction}
          clearAction={clearAction}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the redirect entry point**

Create `app/(app)/menu/page.tsx`:

```tsx
import { redirect } from "next/navigation"

import { weekStartFor } from "@/lib/week"

// Without this, Next would render the redirect at build time and bake in
// whichever week was current when the deploy happened.
export const dynamic = "force-dynamic"

export default function MenuPage() {
  const weekStart = weekStartFor(new Date())
  redirect(`/menu/${weekStart.toISOString().slice(0, 10)}`)
}
```

- [ ] **Step 5: Write the week page**

Create `app/(app)/menu/[weekStart]/page.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { emptySlot, saveSlot } from "@/app/(app)/menu/[weekStart]/actions"
import { WeekGrid } from "@/components/menu/week-grid"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { getMenuWeek } from "@/lib/services/menus"
import { listRecipes } from "@/lib/services/recipes"
import { dateForDay, dayIndexFor, weekStartFor } from "@/lib/week"

export const metadata = { title: "Menù" }

const iso = (date: Date) => date.toISOString().slice(0, 10)

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
})

const rangeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

export default async function MenuWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>
}) {
  const { weekStart: raw } = await params
  const parsed = WeekStartSchema.safeParse(raw)

  // A week that is not a Monday, or not a date at all, is not a week that
  // exists — not an error to report.
  if (!parsed.success) notFound()

  const weekStart = parsed.data
  const [slots, recipes] = await Promise.all([
    getMenuWeek(weekStart),
    listRecipes(),
  ])

  const dayLabels = Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    dayFormat.format(dateForDay(weekStart, day))
  )

  const isCurrentWeek = iso(weekStartFor(new Date())) === iso(weekStart)
  const todayIndex = isCurrentWeek ? dayIndexFor(new Date()) : -1

  const previous = iso(dateForDay(weekStart, -DAYS_IN_WEEK))
  const next = iso(dateForDay(weekStart, DAYS_IN_WEEK))
  const range = `${rangeFormat.format(weekStart)} – ${rangeFormat.format(
    dateForDay(weekStart, DAYS_IN_WEEK - 1)
  )}`

  return (
    <main className="flex flex-col gap-4 pt-6">
      <PageHeader title="Menù">
        <Button
          variant="outline"
          size="icon"
          aria-label="Settimana precedente"
          render={<Link href={`/menu/${previous}`} />}
          nativeButton={false}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settimana successiva"
          render={<Link href={`/menu/${next}`} />}
          nativeButton={false}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </PageHeader>

      <p className="text-sm text-muted-foreground">{range}</p>

      <WeekGrid
        weekStart={iso(weekStart)}
        slots={slots}
        dayLabels={dayLabels}
        todayIndex={todayIndex}
        recipes={recipes.map(({ id, title }) => ({ id, title }))}
        saveAction={saveSlot}
        clearAction={emptySlot}
      />
    </main>
  )
}
```

- [ ] **Step 6: Write the two state files**

Create `app/(app)/menu/[weekStart]/loading.tsx`:

```tsx
import { ListSkeleton } from "@/components/page/list-skeleton"

export default function Loading() {
  return <ListSkeleton label="Caricamento del menù…" rows={7} />
}
```

Create `app/(app)/menu/[weekStart]/error.tsx`:

```tsx
"use client"

import { PageError } from "@/components/page/page-error"

// `"use client"` stays here even though PageError carries its own: Next
// requires an error boundary file to be a client component regardless.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError reset={reset} />
}
```

There is deliberately no `EmptyState` on this screen. A week with nothing in it is fourteen cells reading "Vuoto", which is the working state of a menu you are about to fill in — not an empty list needing an explanation.

- [ ] **Step 7: Add the navigation entry**

In `components/app-sidebar.tsx`, extend the import and put the menu first:

```tsx
import { BookOpen, CalendarDays, Carrot } from "lucide-react"
```

```tsx
const NAV_ITEMS = [
  { href: "/menu", label: "Menù", icon: CalendarDays },
  { href: "/recipes", label: "Ricettario", icon: BookOpen },
  { href: "/ingredients", label: "Ingredienti", icon: Carrot },
] as const
```

First, because it is the entry point of the weekly loop. The existing `isActive` test already covers `/menu/2026-08-17` through its `startsWith` branch.

- [x] **Step 8: Verify**

```powershell
pnpm verify
```

Expected: green.

- [x] **Step 9: Manual browser check**

At 390px, with `pnpm dev` running. The owner has asked that this stay a written checklist; it can be executed by an agent through the `playwright` MCP server.

1. The side menu shows "Menù" first, and it highlights on `/menu/2026-08-17`.
2. `/menu` lands on the current week; the day whose block is bolded is today.
3. Seven blocks, each with Pranzo and Cena, each reading "Vuoto" on a fresh week.
4. Tap a slot, type three letters of a recipe title — the list filters. Pick it, save: the drawer closes and the slot shows the title.
5. Reopen the same slot and save a note instead: the slot shows it in italics. Saving a recipe **and** a note together must fail with "Uno slot può contenere una ricetta oppure una nota, non entrambe." and leave the drawer open.
6. "Svuota" returns the slot to "Vuoto".
7. The arrows move a week at a time and the URL follows. Back returns to the previous week. A saved slot is still there on returning.
8. `/menu/2026-08-19` — not a Monday — renders the 404, not a crash and not a second row for the same week.
9. Open a slot, close the drawer without saving, then open a **different** slot: the picker must be empty, not still holding the first slot's recipe.
10. Set the servings to 3 on one slot and save; reopen it and the 3 is still there.

- [x] **Step 10: Commit**

```powershell
git add -A
git commit -m "feat: plan and edit the weekly menu by hand"
```

---

## Task 5: Design review and documentation

**Files:**

- Modify: whatever the review finds
- Modify: `docs/superpowers/specs/2026-08-13-menu-spesa-design.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run the guidelines**

Use `.agents/skills/web-design-guidelines/` over:

```
components/menu/week-grid.tsx
components/menu/day-block.tsx
components/menu/slot-drawer.tsx
components/menu/recipe-picker.tsx
app/(app)/menu/[weekStart]/page.tsx
components/app-sidebar.tsx
```

- [ ] **Step 2: Triage**

Fix focus order, keyboard reachability, labels, live regions, contrast, heading structure, long-content overflow. Two the guidelines are likely to raise, and what to do with them:

- **`overscroll-behavior: contain` on the drawer.** The guidelines require it on drawers and sheets, and `docs/roadmap.md` already lists its absence as a parked defect. This plan is the first to put a drawer on screen, so fold the fix in here rather than leaving it parked. Fix it in `app/globals.css`, not by editing `components/ui/drawer.tsx`.
- **`aria-describedby` on the fields.** The ingredient form learned this the hard way: a `FieldDescription` that is not referenced is never announced. Reuse the `describedBy` helper shape from `components/ingredients/ingredient-form.tsx`.

**Dismiss any finding about control or touch-target size**, naming the decision in `docs/conventions/ui.md` under "Touch targets". Do not edit `components/ui/`.

- [ ] **Step 3: Record the spec deviation**

In `docs/superpowers/specs/2026-08-13-menu-spesa-design.md`, §6.2, replace the parenthetical naming the `command` palette so the next reader does not reintroduce it:

```markdown
- assign any recipe to any slot (search via the shadcn `combobox`, which
  filters as you type — decided 2026-08-14, replacing the `command` palette
  this section originally named: `combobox` was already installed and already
  the ingredient picker, and two different search interactions for one gesture
  is worse than either of them)
```

- [ ] **Step 4: Move the roadmap row**

In `docs/roadmap.md`, delete section "1. Weekly menu" from "Not started", renumber the sections that follow, and add to the "Shipped" table:

```markdown
| [`2026-08-14-weekly-menu`](superpowers/plans/2026-08-14-weekly-menu.md) | `/menu/[weekStart]`, the fourteen-slot grid, the slot drawer, and `lib/services/menus.ts` — all by hand, no LLM |
```

Then update the LLM entry that remains: the menu no longer waits on `lib/services/llm.ts`; generation does.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm verify
git add -A
git commit -m "fix: address the design review of the menu screens"
```

---

## Out of scope, deliberately

- **Menu generation and `lib/services/llm.ts`.** The next plan. §7.1 fixes the surface it must expose; §8 fixes the rule it must obey.
- **The shopping list.** `aggregateShoppingList` is written and tested and reads the grid this plan produces. The plan after next.
- **Moving a recipe between slots.** Removed on purpose — see the top of this plan.
- **A cooldown over recently cooked recipes.** It exists to filter the candidates handed to the LLM (§6.2), so it belongs to the generation plan. Note for whoever writes it: nothing in the schema records when a recipe was cooked, so "recently cooked" has to be derived from the `MenuSlot` rows of past weeks. That is a design question, not an oversight to patch quietly.
- **The parked defects** other than `overscroll-behavior`, which Task 5 folds in because this is the plan that first shows a drawer.
