# More Than One Dish per Meal — Design Document

**Date:** 2026-09-01
**Status:** Design approved, implementation in the same branch
**Scope:** the weekly menu grid and the model under it
**Parent:** [`2026-08-13-menu-spesa-design.md`](2026-08-13-menu-spesa-design.md).
This document **amends** its §6.2 — see §2.

---

## 1. Purpose

A meal holds exactly one recipe, so a lunch of pasta and a salad has nowhere to
go. The workaround the grid forces is a recipe called "Pasta al pesto e insalata
mista": two dishes wearing one title, reusable as neither, and the recipe book
fills with combinations instead of dishes.

**A meal now holds any number of dishes.** Two, or ten. They are a list, not a
set of labelled positions: nothing says which is the primo and nothing needs to.

### What this replaces

An earlier attempt gave each meal three fixed slots — primo, secondo,
contorno — with the course tagged on the recipe. It was designed, built and
verified, then withdrawn before merging: the labels turned out to be ceremony
around the thing actually wanted, which is simply _more than one_. Its design
document is not in the repository, and no part of it reached `main`.

The lesson worth keeping: a fixed set of positions is what caused the original
problem, and replacing three positions with three different positions would have
carried it forward.

---

## 2. What this amends in the parent spec

| Parent spec §6.2 says                  | This document decides                             | Why                                                                                                                        |
| -------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The grid is **14 slots**, one per meal | A meal holds **a list of entries**, of any length | §1. One dish per meal is the constraint that produced the combination recipes.                                             |
| A slot is addressed by `[day, meal]`   | An entry is addressed by **its own id**           | Two entries of one meal are no longer distinguishable by position in the grid, so the row has to carry its own identity.   |
| "clear a slot" empties a fixed cell    | Emptying an entry **removes it from the list**    | An absent entry and an empty one must mean the same thing — the rule the old grid already had, now with nothing left over. |

---

## 3. The model

`MenuSlot` becomes **`MenuEntry`**. The rename is not cosmetic: "slot" means a
position that exists whether or not it is filled, and that word is what would
invite the next person to put the one-per-meal constraint back.

```prisma
model MenuEntry {
  id       String   @id @default(cuid())
  menuId   String
  menu     Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  day      Int
  meal     MealType
  // Where it sits in its meal's list. Assigned as max + 1 within the meal, and
  // deliberately not unique: two entries added at the same instant would then
  // make one of them fail, and a shared position costs nothing — the sort
  // breaks the tie on the id and the order stays stable.
  position Int
  recipeId String?
  recipe   Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  freeText String?
  servings Int?

  @@index([menuId, day, meal])
}
```

The old `@@unique([menuId, day, meal])` is gone. It was the whole constraint.

**No course, no kind, no label on the recipe.** `Recipe` is untouched by this
change.

### A note is an entry

"fuori a cena" stays what it is today: an entry carrying `freeText` instead of
`recipeId`, never both. The rule is unchanged — only the number of entries a
meal may hold is. A meal that is a note and nothing else is a meal with one
text entry, which reads correctly with no extra concept.

---

## 4. Services — `lib/services/menus.ts`

```ts
type EntryAddress = { day: number; meal: Meal }

getMenuWeek(weekStart: Date): Promise<MenuEntryView[]>
addEntry(weekStart: Date, at: EntryAddress, input: EntryInput): Promise<void>
updateEntry(entryId: string, input: EntryInput): Promise<void>
removeEntry(entryId: string): Promise<void>
replaceWeekEntries(weekStart: Date, entries: readonly {…}[]): Promise<void>
isWeekEmpty(weekStart: Date): Promise<boolean>
```

`MenuEntryView` carries the entry's `id`, because the client now needs to say
which row it is editing.

`getMenuWeek` returns only the entries that exist, ordered by day, then lunch
before dinner, then position, then id. `sortEntries` is a pure function with its
own test; the fourteen-slot densification `buildWeekSlots` did is removed with
its five tests, because there is no fixed grid left to densify into.

`updateEntry` with every field empty deletes the row, delegating to
`removeEntry` — the rule `setSlot` already had, and the reason "Svuota i campi
per liberare lo slot" still works as an instruction.

Every write touches `Menu.slotsUpdatedAt`, so the shopping list still knows it
has been overtaken.

---

## 5. The grid

```
lun 24
┌──────────────────────────────────┐
│ PRANZO                        +  │
│   Pasta al pesto              📖 │
│   Insalata di pere            📖 │
│ CENA                          +  │
│   fuori a cena                   │
└──────────────────────────────────┘
```

The meal is a header row: its name on the left, a single **+** hard right. The
entries follow, in the order they were added. A meal with nothing in it is the
header alone.

The **+** opens the same drawer that tapping an existing row opens — one panel
for adding and for editing, rather than a fast path for one and a form for the
other. Its title is `lun 24 · Pranzo`. The recipe picker is not filtered by
anything, because there is nothing left to filter by.

**No reordering.** Entries appear in the order they were added; moving one means
removing it and adding it again. A meal is two or three dishes, not a running
order, and two buttons per row is a lot to carry at 390px for a gesture nobody
has asked for.

---

## 6. What does not change

**The shopping list's arithmetic.** `shopping-aggregate.ts` groups by ingredient
name and unit, scales by servings, and records the days a line is needed for. It
has never read `meal` and does not read `position`. Three entries on Monday reach
it as three rows with `day: 0`, which is what a lunch and a dinner have always
been, so not one line of it changes — and its `AggregatorSlot` keeps its name,
because that module's vocabulary is its own and its tests are the most heavily
exercised in the repository.

`shopping-lists.ts` is touched, but only by the renames: it reads
`entriesUpdatedAt` instead of `slotsUpdatedAt` and `menu.entries` instead of
`menu.slots`. What it does with them is unchanged.

**The LLM proposal.** `proposeMenu` still answers one recipe per meal. Each
becomes that meal's only entry, at position 0. The prompt, which lives in the
`LlmFunction` row, is not touched. Teaching it to propose several dishes per
meal is its own piece of work.

---

## 7. Testing

Per `docs/conventions/testing.md`, what is costly to get wrong:

- `sortEntries` — the order of the grid, replacing `buildWeekSlots`'s tests.
- `nextPosition` — that an entry is appended rather than inserted, and that an
  empty meal starts at zero.
- `resolveProposal` still resolving to entries the writer accepts.

Not tested: the drawer, the `+`, the picker. Closed with `pnpm verify`,
`web-design-guidelines` over the changed files, and a browser pass at 390px on a
meal with none, one and several dishes.
