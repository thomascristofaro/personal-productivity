# Three Courses per Meal — Design Document

**Date:** 2026-08-30
**Status:** Design approved, pending implementation plan
**Scope:** the weekly menu grid, the recipe's course tag, and what they touch
**Parent:** [`2026-08-13-menu-spesa-design.md`](2026-08-13-menu-spesa-design.md).
This document **amends** its §6.2 — see §2. Where the two disagree, this one
governs the grid.

---

## 1. Purpose

A meal holds one slot today, so a lunch of pasta and a salad has nowhere to go.
The workaround the grid forces is a recipe called "Pasta al pesto e insalata
mista", which is two dishes wearing one title: it cannot be reused separately,
its ingredients cannot be scaled separately, and the recipe book fills with
combinations instead of dishes.

This change gives each meal **three slots — primo, secondo, contorno** — and
tags each recipe with the one it belongs to, so the picker for a slot offers
only what fits it.

**Manual only.** The LLM proposal keeps working unchanged (§7); teaching it to
compose three courses is separate work and is out of scope here.

### Success criterion

A week of pasta-plus-side lunches can be composed from single-dish recipes, and
the recipe book stops accumulating combinations.

---

## 2. What this amends in the parent spec

| Parent spec §6.2 says                  | This document decides                                             | Why                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The grid is **14 slots**, one per meal | The grid is **up to 42**: three courses per meal                  | §1. One slot per meal is the constraint that produced the combination recipes.                                                       |
| The grid always shows every slot       | The grid shows **only the filled ones**, plus a chip per gap      | 42 always-visible rows is 2,300px of scrolling on a phone for a week that is typically half empty. §5.                               |
| "assign any recipe to any slot"        | The picker is **filtered by the slot's course**, with an override | The filter is what makes three slots useful. The override is what stops the filter becoming the next version of the problem. §4, §5. |

`buildWeekSlots` in `lib/services/menus.ts` exists to densify a sparse week into
fourteen. It is removed by this change, with its five tests.

---

## 3. The data model

```prisma
/// The Italian courses. FIRST is a primo — pasta, risotto, a soup, an
/// insalatona; SECOND a secondo — meat, fish, eggs; SIDE a contorno.
enum Course {
  FIRST
  SECOND
  SIDE
}

model Recipe {
  // ...
  course Course
}

model MenuSlot {
  // ...
  course Course

  @@unique([menuId, day, meal, course])   // was [menuId, day, meal]
}
```

**Required on both, with no `@default` in the schema.** A default would make
every recipe saved without a choice silently become a secondo, and the whole
value of this change is that the tag is right. The migration supplies the value
for the rows that already exist and then takes the default away:

```sql
CREATE TYPE "Course" AS ENUM ('FIRST', 'SECOND', 'SIDE');

ALTER TABLE "Recipe"   ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "Recipe"   ALTER COLUMN "course" DROP DEFAULT;
ALTER TABLE "MenuSlot" ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "MenuSlot" ALTER COLUMN "course" DROP DEFAULT;

DROP INDEX "MenuSlot_menuId_day_meal_key";
CREATE UNIQUE INDEX "MenuSlot_menuId_day_meal_course_key"
  ON "MenuSlot" ("menuId", "day", "meal", "course");
```

Written by hand into the file `prisma migrate dev` generates, because Prisma
cannot express add-with-default-then-drop-default from a schema that declares no
default. Existing recipes and existing menu slots all become `SECOND`; the owner
retags the recipes afterwards. No collision is possible on the new unique index,
since the old one already forbade two rows sharing `[menuId, day, meal]`.

`lib/courses.ts` holds `COURSES` — the canonical order — with `courseLabel` and
`courseRank` beside it, shaped exactly like `lib/aisles.ts`, which does the same
job for the shopping list. The Italian labels `Primo`, `Secondo` and `Contorno`
live there and nowhere else.

### 3.1 Which course is authoritative

**The slot's course governs the grid. The recipe's course only filters the
picker.** `setSlot` accepts any recipe in any slot and performs no consistency
check.

This is deliberate. A constraint tying `MenuSlot.course` to `Recipe.course` —
whether a composite foreign key or a check in the service — would forbid using
the insalatona as tonight's contorno, which is a real thing the household does,
and the boundary between the courses is genuinely soft. A mismatch also costs
nothing downstream: the shopping list aggregates by ingredient and day and never
reads the course (§6).

It follows that **changing a recipe's course does not move it in any menu**,
past or present. The slot keeps the position it was given.

---

## 4. Services

### `lib/services/menus.ts`

`getMenuWeek` stops densifying. It returns **only the rows that exist**, sorted
by day, then meal, then course. Every stored row is a filled row by
construction, because `setSlot` deletes a slot whose fields are all empty — a
rule that predates this change and now also means the page's "how many slots are
filled" is `slots.length`.

`buildWeekSlots` is replaced by a pure `sortSlots`, which carries its own test.
The sort uses explicit rank arrays rather than `orderBy: { course: "asc" }`:
Postgres does order an enum by declaration order, so the query would work, but
that makes the grid's order depend on the order of three lines in the schema
with nothing on screen to say so.

`setSlot` and `clearSlot` change shape:

```ts
type SlotAddress = { day: number; meal: Meal; course: Course }

setSlot(weekStart: Date, address: SlotAddress, input: SlotInput): Promise<void>
clearSlot(weekStart: Date, address: SlotAddress): Promise<void>
```

Not a fifth positional argument: `weekStart, day, meal, course, input` is four
values in a row that are easy to transpose, and `actions.ts` already has an
`addressFrom` helper that produces exactly this shape. Their logic is otherwise
unchanged, including the `slotsUpdatedAt` touch and the delete-on-empty rule.

`replaceWeekSlots` takes the course with each slot. `isWeekEmpty` is unchanged.

### `lib/services/recipes.ts`

`RecipeSummary` gains `course`, so the menu page can pass it to the picker and
the recipe list can show a badge. `createRecipe` and `updateRecipe` write it
from `RecipeInput`.

### Schemas

`CourseSchema` is `z.enum(COURSES)` and lives in its own `lib/schemas/course.ts`,
because both the menu and the recipe need it and neither owns it — having
`recipe.ts` import it from `menu.ts` would assert a dependency that is not real.

`lib/schemas/menu.ts` puts the course in the slot address. `SlotInputSchema` is
untouched: the course addresses the slot, it is not part of its contents, and
the recipe-or-note rule it enforces still holds.

`lib/schemas/recipe.ts` gains a required `course` with an Italian message.

---

## 5. The grid

### What a day looks like

```
Lunedì 1
┌──────────────────────────────────┐
│ Pranzo                           │
│   Primo      Pasta al pesto    📖 │
│   Contorno   Insalata mista    📖 │
│   + Secondo                      │
│ ──────────────────────────────── │
│ Cena                             │
│   + Primo   + Secondo  + Contorno │
└──────────────────────────────────┘
```

A filled course is the row that exists today — course label above, title below,
the whole row opening the drawer, and the book icon beside it linking to the
recipe. Free text renders italic and muted, and has no icon, as now.

Under the filled rows, **one chip per missing course**, in canonical order. A
full meal shows no chips. An empty meal shows three.

Chips rather than a single `+` opening a menu: three short words fit one line at
390px, the slot is one tap away instead of two, and there is no popup to
dismiss. The chip synthesises an empty slot — that day, that meal, that course,
all fields null — and opens the same drawer a filled row does.

### The drawer

Title `Lun 1 · Pranzo · Primo`. One more hidden field, `course`. The recipe
picker is **filtered to the slot's course**, with a checkbox beside it —
_"Mostra tutte le ricette"_ — that removes the filter for that drawer only.

The checkbox is not hedging. The problem this whole change exists to solve is a
grid that forces the food into a shape it does not have; a filter with no way
out would reproduce that at a smaller scale, and §3.1 has already established
that a cross-course assignment is legitimate and harmless.

Note and servings stay on the slot, one of each per course. "Fuori a cena" is
therefore written in one of the three rows rather than on the meal. That is
slightly wrong semantically and costs nothing: a slot holding a note holds no
recipe, so the meal reads as a note plus two gaps, which is what it means.

Emptying every field still deletes the row, so the course goes back to being a
chip.

---

## 6. The shopping list does not change

`shopping-aggregate.ts` groups by ingredient name and unit, scales by the slot's
servings over the recipe's, and records the days a line is needed for. It never
reads `meal`, and it will never read `course`. Three slots on Monday reach it as
three `AggregatorSlot`s with `day: 0` — a case it already handles, because a
lunch and a dinner have always both been day 0.

No file under `lib/services/shopping-*` is touched by this change.

---

## 7. The LLM proposal keeps working, unchanged

`proposeMenu` continues to propose **one recipe per meal**, and each one is
written into the slot of its own course. `resolveProposal` reads the course from
the candidate it resolves; `loadCandidates` selects it; `menu-candidates.ts`
puts it on the candidate's line so the model can see it. The prompt text, which
lives in the `LlmFunction` row and not in the code, is not touched.

The consequence is stated rather than hidden: **a generated week may come out
all contorni**, since nothing yet tells the model to balance the courses. This
is acceptable because generation only runs on an empty week and can be run
again, and because the manual grid — the point of this change — is unaffected.

Teaching the proposal to fill three courses is its own piece of work, against
[`2026-08-21-menu-generation-design.md`](2026-08-21-menu-generation-design.md).
It is out of scope here.

---

## 8. The recipe form

A required single-choice control, using `components/ui/select.tsx` — the only
single-choice control the project already has, and adding a radio group for
three options would be a new base component for no gain.

**No preselection.** The placeholder reads _"Scegli…"_ and Zod refuses a recipe
without a course. Preselecting "Secondo" would mean every recipe imported from a
URL becomes a secondo without anyone deciding it, and `RecipeDraft` carries no
signal the importer could use to guess better. One deliberate tap per recipe is
the right price for the tag being right.

The course shows as a badge in the recipe list and on the recipe page. **No
filter by course in the recipe list** — not asked for, and the picker inside the
drawer is where the filtering actually matters.

---

## 9. Testing

Per `docs/conventions/testing.md`, what is costly to get wrong:

- `sortSlots` — the order of the grid, replacing `buildWeekSlots`'s tests.
- The course in the slot address schema, and its rejection of an unknown value.
- The required course in `RecipeInputSchema`.
- `resolveProposal` emitting the candidate's course.

Not tested: the `Select`, the chips, the picker's filter. They are shadcn
internals and rendering.

Closed with `pnpm verify`, `web-design-guidelines` over the changed files, and a
browser pass at 390px on a week that is empty, half full and full.

---

## 10. Out of scope

- Teaching the LLM to propose three courses (§7).
- A meal-level note (§5).
- Filtering the recipe list by course (§8).
- A fourth course for a _piatto unico_. Considered and dropped: a lasagna can be
  a primo with the other two slots left empty, which the sparse grid already
  expresses, and a fourth enum value would need a rule in every place that
  renders a meal.
- Moving a recipe between slots. Still what the parent spec §6.2 decided in
  August, and three slots per meal do not change the arithmetic.
