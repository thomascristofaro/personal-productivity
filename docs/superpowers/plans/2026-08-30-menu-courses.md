# Three Courses per Meal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every meal three slots — primo, secondo, contorno — and tag every recipe with the course it belongs to, so the picker for a slot offers only what fits it.

**Architecture:** A `Course` enum lands on both `Recipe` and `MenuSlot`. `MenuSlot`'s unique key grows from `[menuId, day, meal]` to `[menuId, day, meal, course]`, so a meal can hold up to three rows. The grid stops densifying a week into fourteen fixed slots and instead renders the rows that exist, with one chip per missing course. The slot's course governs the grid; the recipe's course only filters the picker.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 (`prisma-client` generator into `lib/generated/prisma`, `pg` driver adapter), Postgres, Zod 4, Base UI via shadcn/ui, Vitest, Tailwind 4.

**Spec:** [`docs/superpowers/specs/2026-08-30-menu-courses-design.md`](../specs/2026-08-30-menu-courses-design.md)

## Global Constraints

- **Language split.** Italian for everything the user reads — labels, buttons, error messages, placeholders. English for identifiers, comments, TSDoc, file names, commit messages, test names.
- **`pnpm verify` is the gate** — `tsc --noEmit && eslint && vitest run`. "It should work" is not a report.
- **Layering.** `lib/services/` may not import from `app/`, `components/` or `hooks/`, may not import React or `next/*`, and may not touch `Request`, `Response`, `cookies()` or `headers()`. ESLint fails the build on a violation.
- **TSDoc on every exported function in `lib/services/`** — one-line summary, `@param`, `@returns`, `@throws` if it throws. No types in the block. ESLint enforces it; private helpers are exempt.
- **Server actions validate with Zod and call `requireSession()` before mutating.** A server action is a public endpoint.
- **Prisma only through `db` from `lib/db.ts`.** Schema changes go through a migration; never edit the database by hand.
- **Every base component comes from shadcn/ui**, edited in place in `components/ui/`. Never wrapped, never hand-written.
- **Comment only _why_.** No section dividers, no commented-out code, no comment that restates the line below it.
- **Environment quirk — run pnpm from the PowerShell tool**, prefixing the call in the same invocation with:
  ```powershell
  $env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
  ```
  A `.CMD` shim in `node_modules/.bin` resolves a bare `node`, and this machine's PATH breaks that. `git` needs no such prefix.
- **Never run `pnpm format`** — it reformats the whole repository. Use `pnpm exec prettier --write <file>` on the files you touched.
- The dev server on port 3000 is the owner's. Reuse it rather than starting a second one.

---

## File Structure

**Created**

| File                                | Responsibility                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| `lib/courses.ts`                    | `COURSES`, `Course`, `COURSE_LABELS`, `courseRank` — the vocabulary |
| `lib/schemas/course.ts`             | `CourseSchema`, shared by the menu and the recipe                   |
| `prisma/migrations/*_recipe_course` | the enum and `Recipe.course`                                        |
| `prisma/migrations/*_slot_course`   | `MenuSlot.course` and the widened unique index                      |

**Modified**

| File                                         | Change                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `prisma/schema.prisma`                       | `enum Course`, `Recipe.course`, `MenuSlot.course`, the unique key         |
| `lib/schemas/recipe.ts`                      | required `course`                                                         |
| `lib/schemas/menu.ts`                        | `SlotAddressSchema`                                                       |
| `lib/services/recipes.ts`                    | `course` in the summary, the select and the columns                       |
| `lib/services/menus.ts`                      | `sortSlots` replaces `buildWeekSlots`; `SlotAddress` in the three writers |
| `lib/services/menus.test.ts`                 | `buildWeekSlots` tests out, `sortSlots` tests in                          |
| `lib/services/menu-candidates.ts` + its test | the course on the candidate line and in the index                         |
| `lib/services/menu-proposal.ts` + its test   | the course through `loadCandidates` and `resolveProposal`                 |
| `components/page/fields.tsx`                 | `SelectField` gains `placeholder` and an empty-means-unset rule           |
| `components/recipes/recipe-form.tsx`         | the course `SelectField`                                                  |
| `app/(app)/recipes/actions.ts`               | reads `course` from the form                                              |
| `app/(app)/recipes/new/page.tsx`             | `course: ""` in the initial values                                        |
| `app/(app)/recipes/[id]/edit/page.tsx`       | `course: recipe.course`                                                   |
| `app/(app)/import/page.tsx`                  | `course: ""` in `empty()` and `filled()`                                  |
| `app/(app)/recipes/page.tsx`                 | course badge                                                              |
| `app/(app)/recipes/[id]/page.tsx`            | course badge                                                              |
| `app/(app)/menu/[weekStart]/actions.ts`      | the course in the slot address                                            |
| `app/(app)/menu/[weekStart]/page.tsx`        | `slots.length`, and the course on each recipe option                      |
| `components/menu/week-grid.tsx`              | opens by address, synthesising an empty slot                              |
| `components/menu/day-block.tsx`              | meal blocks with filled rows plus chips                                   |
| `components/menu/slot-drawer.tsx`            | the course in the address, the filtered picker, the override              |
| `components/menu/recipe-picker.tsx`          | `RecipeOption` gains `course`                                             |
| `docs/roadmap.md`                            | records what shipped                                                      |

**Untouched, and deliberately so:** everything under `lib/services/shopping-*`. The aggregator groups by ingredient and day and never reads the meal, so three slots on Monday are a case it already handles.

---

### Task 1: The course vocabulary

**Files:**

- Create: `lib/courses.ts`
- Create: `lib/schemas/course.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `COURSES: readonly ["FIRST", "SECOND", "SIDE"]`, `type Course = "FIRST" | "SECOND" | "SIDE"`, `COURSE_LABELS: Record<Course, string>`, `courseRank(course: Course): number`, `CourseSchema: z.ZodEnum`.

No unit test. `lib/aisles.ts` is the same shape and has none: `COURSE_LABELS` is typed `Record<Course, string>`, so a missing course is a compile error rather than something a test could discover, and `courseRank` is `indexOf` over a three-element tuple. The order it produces is tested where it is used, in Task 4's `sortSlots`.

- [ ] **Step 1: Write `lib/courses.ts`**

```ts
// The Italian courses of a meal. The order is the order a meal is eaten and the
// order the grid renders; nothing else depends on the positions.
export const COURSES = ["FIRST", "SECOND", "SIDE"] as const

export type Course = (typeof COURSES)[number]

// The only place these three words exist. Italian, because the user reads them.
export const COURSE_LABELS: Record<Course, string> = {
  FIRST: "Primo",
  SECOND: "Secondo",
  SIDE: "Contorno",
}

export function courseRank(course: Course): number {
  return COURSES.indexOf(course)
}
```

- [ ] **Step 2: Write `lib/schemas/course.ts`**

```ts
import { z } from "zod"

import { COURSES } from "@/lib/courses"

// Carries a message, unlike MealSchema: the meal is a hidden field nobody ever
// types, but the course is a control the form leaves unset until it is chosen,
// so this message is one the user can actually reach.
export const CourseSchema = z.enum(
  COURSES,
  "Scegli se è un primo, un secondo o un contorno."
)
```

- [ ] **Step 3: Typecheck and lint**

Run (PowerShell, with the PATH prefix from Global Constraints):

```
pnpm typecheck && pnpm lint
```

Expected: both clean. Nothing imports these two files yet.

- [ ] **Step 4: Commit**

```bash
git add lib/courses.ts lib/schemas/course.ts
git commit -m "feat: name the three courses in one place"
```

---

### Task 2: `Recipe.course`

Deliverable: every recipe carries a course, chosen in the form and visible in the book. The menu is untouched and still works.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_recipe_course/migration.sql`
- Modify: `lib/schemas/recipe.ts`
- Modify: `lib/services/recipes.ts`
- Modify: `components/page/fields.tsx`
- Modify: `components/recipes/recipe-form.tsx`
- Modify: `app/(app)/recipes/actions.ts`
- Modify: `app/(app)/recipes/new/page.tsx`, `app/(app)/recipes/[id]/edit/page.tsx`, `app/(app)/import/page.tsx`
- Modify: `app/(app)/recipes/page.tsx`, `app/(app)/recipes/[id]/page.tsx`

**Interfaces:**

- Consumes: `COURSES`, `Course`, `COURSE_LABELS` from `lib/courses.ts`; `CourseSchema` from `lib/schemas/course.ts`.
- Produces: `RecipeInput.course: Course`; `RecipeSummary.course: Course` (and therefore `RecipeDetail.course`); `SelectField` accepting an optional `placeholder?: string`.

- [ ] **Step 1: Add the enum and the column to the schema**

In `prisma/schema.prisma`, add the enum immediately above `model Recipe`:

```prisma
// The Italian courses of a meal. FIRST is a primo — pasta, risotto, a soup, an
// insalatona; SECOND a secondo — meat, fish, eggs; SIDE a contorno.
enum Course {
  FIRST
  SECOND
  SIDE
}
```

and the field to `Recipe`, on the line after `title`:

```prisma
  // No @default: one would make every recipe saved without a choice a secondo
  // in silence, and the tag being right is the whole point of the column. The
  // migration fills the existing rows and then drops the default it used.
  course       Course
```

- [ ] **Step 2: Create the migration without applying it**

Run:

```
pnpm exec prisma migrate dev --create-only --name recipe_course
```

Expected: a new folder `prisma/migrations/<timestamp>_recipe_course/` containing `migration.sql`. Prisma may warn that the column cannot be added to a non-empty table — that is exactly what the next step fixes, so do not answer any prompt by dropping data.

- [ ] **Step 3: Replace the generated SQL**

Overwrite `prisma/migrations/<timestamp>_recipe_course/migration.sql` with:

```sql
CREATE TYPE "Course" AS ENUM ('FIRST', 'SECOND', 'SIDE');

-- The default exists only to fill the rows that are already here. Dropping it
-- immediately is what makes a recipe saved without a course fail loudly.
ALTER TABLE "Recipe" ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "Recipe" ALTER COLUMN "course" DROP DEFAULT;
```

- [ ] **Step 4: Apply it and regenerate the client**

Run:

```
pnpm db:migrate && pnpm db:generate
```

Expected: the migration applies, and `lib/generated/prisma` now exports `Course`.

- [ ] **Step 5: Write the failing schema test**

In `lib/schemas/recipe.test.ts`, add `course: "SECOND",` to the `valid` fixture, immediately after `title` — every existing case runs through `parse()`, which spreads that fixture, so without this they all start failing for the wrong reason.

Then add these two cases inside the existing `describe("RecipeInputSchema", …)` block:

```ts
it("refuses a recipe with no course, in Italian", () => {
  const parsed = parse({ course: "" })

  expect(parsed.success).toBe(false)
  expect(parsed.error?.issues[0].message).toBe(
    "Scegli se è un primo, un secondo o un contorno."
  )
})

it("accepts each of the three courses", () => {
  for (const course of ["FIRST", "SECOND", "SIDE"]) {
    expect(parse({ course }).success).toBe(true)
  }
})
```

- [ ] **Step 6: Run it and watch it fail**

Run:

```
pnpm exec vitest run lib/schemas/recipe.test.ts
```

Expected: FAIL — the schema has no `course`, so the first case parses successfully and the second says nothing.

- [ ] **Step 7: Add the field to `RecipeInputSchema`**

In `lib/schemas/recipe.ts`, add the import:

```ts
import { CourseSchema } from "@/lib/schemas/course"
```

and the field, immediately after `title` in the object:

```ts
  course: CourseSchema,
```

- [ ] **Step 8: Run the test again**

Run:

```
pnpm exec vitest run lib/schemas/recipe.test.ts
```

Expected: PASS.

- [ ] **Step 9: Carry the course through the recipe service**

In `lib/services/recipes.ts`, three edits.

Add the import:

```ts
import type { Course } from "@/lib/courses"
```

Add to `RecipeSummary` (after `title`):

```ts
course: Course
```

Add to `summaryFields` (after `title: true`):

```ts
  course: true,
```

Add to `toColumns` (after `title: input.title,`):

```ts
    course: input.course,
```

`RecipeDetail` extends `RecipeSummary` and `getRecipe` spreads `summaryFields`, so both pick the column up with no further change.

- [ ] **Step 10: Teach `SelectField` about an unset value**

In `components/page/fields.tsx`, `SelectField` currently renders `<SelectValue />` and passes `defaultValue` straight through. Base UI shows a placeholder only when the value is `null`, while `fieldProps` supplies `""` for a field nobody has filled — so the two have to be made the same thing.

Add `placeholder` to the destructured props and to the type:

```ts
export function SelectField({
  label,
  description,
  error,
  options,
  id,
  name,
  defaultValue,
  placeholder,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  ...rest
}: Ours & {
  name: string
  defaultValue?: string
  placeholder?: string
  "aria-invalid"?: true
  "aria-describedby"?: string
  options: readonly string[] | Record<string, string>
  value?: string
  onValueChange?: (value: string | null) => void
}) {
```

Then change the two lines inside the returned JSX:

```tsx
      <Select
        name={name}
        // `fieldProps` gives an unfilled field "", and Base UI treats that as a
        // chosen value: the placeholder shows for null and for nothing else.
        defaultValue={defaultValue === "" ? null : defaultValue}
        items={items}
        {...rest}
      >
        <SelectTrigger
          id={id}
          aria-invalid={invalid}
          aria-describedby={mergeDescribedBy(
            id,
            description !== undefined,
            describedBy
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
```

Leave the rest of the component alone. No existing call site passes `""`, so this changes nothing for the aisle, kind, provider or category selects.

- [ ] **Step 11: Add the control to the recipe form**

In `components/recipes/recipe-form.tsx`:

Add the imports:

```ts
import { SelectField } from "@/components/page/fields"
import { COURSE_LABELS } from "@/lib/courses"
```

`SelectField` joins the existing `NumberField, TextareaField, TextField` import from the same module rather than being a second import line.

Add `course: string` to `RecipeFormValues`, after `title`.

Add `"course"` to `FIELD_ORDER`, after `"title"` — the array is DOM order, and the control sits directly under the name.

Add `course: values.course` to the `useFormState` initial values.

Insert the control immediately after the title `TextField` and before the ingredients `fieldset`:

```tsx
<SelectField
  key={form.fieldKey("course")}
  {...form.fieldProps("course")}
  label="Tipo"
  error={form.errorOf("course")}
  description="Decide in quale slot del menù la ricetta si può mettere."
  options={COURSE_LABELS}
  placeholder="Scegli…"
/>
```

- [ ] **Step 12: Read the field in the action**

In `app/(app)/recipes/actions.ts`:

Add `"course"` to `FORM_FIELDS`, after `"title"`, so a refused save echoes the choice back instead of blanking it.

Add to the `RecipeInputSchema.safeParse({ … })` call, after `title`:

```ts
    course: formData.get("course"),
```

- [ ] **Step 13: Fix the three call sites**

`app/(app)/recipes/new/page.tsx` — add to the `values` literal, after `title: ""`:

```tsx
          course: "",
```

`app/(app)/recipes/[id]/edit/page.tsx` — add after `title: recipe.title`:

```tsx
          course: recipe.course,
```

`app/(app)/import/page.tsx` — add `course: ""` to both `empty()` and `filled()`, after `title`. The importer has nothing to guess from: `RecipeDraft` carries no signal about the course, so the confirmation screen asks, which it already exists to do.

- [ ] **Step 14: Show the course in the book**

`app/(app)/recipes/page.tsx` — add the import:

```ts
import { COURSE_LABELS } from "@/lib/courses"
```

and the badge inside `renderItem`, immediately before the `recipe.tags.map(...)` block:

```tsx
<Badge>{COURSE_LABELS[recipe.course]}</Badge>
```

Default variant, not `secondary`: the tags are already secondary, and the course is the one label that is always there.

`app/(app)/recipes/[id]/page.tsx` — same import, and the same badge in the `subtitle` fragment, immediately before `recipe.tags.map(...)`.

- [ ] **Step 15: Verify**

Run:

```
pnpm verify
```

Expected: clean. If `tsc` reports a missing `course` anywhere not listed above, add it there — the compiler is enumerating the call sites for you.

Then format only what you touched:

```
pnpm exec prettier --write prisma/schema.prisma lib/schemas/recipe.ts lib/services/recipes.ts components/page/fields.tsx components/recipes/recipe-form.tsx "app/(app)/recipes/actions.ts" "app/(app)/recipes/page.tsx" "app/(app)/recipes/[id]/page.tsx" "app/(app)/recipes/[id]/edit/page.tsx" "app/(app)/recipes/new/page.tsx" "app/(app)/import/page.tsx"
```

- [ ] **Step 16: Check it in the browser at 390px**

On the running dev server: open `/recipes/new`, confirm the Tipo select reads "Scegli…" in muted text and opens to Primo / Secondo / Contorno. Save without choosing and confirm the Italian message appears under the field. Choose one, save, and confirm the badge shows on `/recipes` and on the recipe page.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "feat: a recipe says whether it is a primo, a secondo or a contorno"
```

---

### Task 3: The proposal carries the course

Deliverable: `proposeMenu` returns a course with every slot, and the model can see each candidate's course. The prompt text, which lives in the `LlmFunction` row and not in the code, is not touched.

**Files:**

- Modify: `lib/services/menu-candidates.ts`, `lib/services/menu-candidates.test.ts`
- Modify: `lib/services/menu-proposal.ts`, `lib/services/menu-proposal.test.ts`

**Interfaces:**

- Consumes: `Course`, `COURSE_LABELS` from `lib/courses.ts`; `Recipe.course` from Task 2.
- Produces: `CandidateRecipe.course: Course`; `CandidateIndex.byNumber: Map<number, { id: string; course: Course }>`; `ProposedMenuSlot.course: Course`.

- [ ] **Step 1: Write the failing candidate test**

In `lib/services/menu-candidates.test.ts`, add `course: "SECOND"` to the `recipe()` fixture (after `title`), then add:

```ts
it("carries the course, so the model can see what it is choosing", () => {
  const lines = buildCandidateLines([recipe({ course: "SIDE" })])

  expect(lines).toContain("contorno")
})
```

and, in the `indexCandidates` describe block:

```ts
it("maps a number to the recipe's id and course", () => {
  const index = indexCandidates([recipe({ id: "r9", course: "FIRST" })])

  expect(index.byNumber.get(1)).toEqual({ id: "r9", course: "FIRST" })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run:

```
pnpm exec vitest run lib/services/menu-candidates.test.ts
```

Expected: FAIL — `course` is not on `CandidateRecipe`, so the fixture does not typecheck and `byNumber` holds bare strings.

- [ ] **Step 3: Add the course to the candidates**

In `lib/services/menu-candidates.ts`:

```ts
import { COURSE_LABELS, type Course } from "@/lib/courses"
```

Add to `CandidateRecipe`, after `title`:

```ts
course: Course
```

Change `CandidateIndex`:

```ts
export type CandidateIndex = {
  byNumber: Map<number, { id: string; course: Course }>
  count: number
}
```

In `describeRecipe`, add the course as the first detail after the title:

```ts
function describeRecipe(recipe: CandidateRecipe, position: number): string {
  const parts = [`${position}. ${recipe.title}`]

  // Lower case, to read as one of the line's details rather than as a heading.
  parts.push(COURSE_LABELS[recipe.course].toLowerCase())
  if (recipe.totalMinutes !== null) parts.push(`${recipe.totalMinutes}min`)
  if (recipe.tags.length > 0) parts.push(recipe.tags.join(", "))
  if (recipe.ingredients.length > 0) parts.push(recipe.ingredients.join(", "))
  if (recipe.lastCookedDaysAgo !== null) {
    parts.push(`ultima volta ${recipe.lastCookedDaysAgo} giorni fa`)
  }

  return parts.join(" — ")
}
```

In `indexCandidates`:

```ts
return {
  byNumber: new Map(
    recipes.map((recipe, i) => [
      i + 1,
      { id: recipe.id, course: recipe.course },
    ])
  ),
  count: recipes.length,
}
```

Update the `@returns` line of `indexCandidates`' TSDoc to say it maps to the id and the course.

- [ ] **Step 4: Run the candidate tests**

Run:

```
pnpm exec vitest run lib/services/menu-candidates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing proposal test**

In `lib/services/menu-proposal.test.ts`, replace the `byNumber` fixture:

```ts
const byNumber = new Map([
  [1, { id: "recipe-one", course: "FIRST" as const }],
  [2, { id: "recipe-two", course: "SECOND" as const }],
])
```

and the first assertion:

```ts
expect(slots).toEqual([
  { day: 0, meal: "LUNCH", course: "SECOND", recipeId: "recipe-two" },
])
```

The other four cases in that file assert on `meal`, `recipeId` and the thrown errors, so they need no edit beyond the fixture.

- [ ] **Step 6: Run it and watch it fail**

Run:

```
pnpm exec vitest run lib/services/menu-proposal.test.ts
```

Expected: FAIL — `resolveProposal` still pushes a slot with no `course`.

- [ ] **Step 7: Resolve the course**

In `lib/services/menu-proposal.ts`:

```ts
import { type Course } from "@/lib/courses"
```

Add to `ProposedMenuSlot`, after `meal`:

```ts
course: Course
```

Rewrite the body of `resolveProposal`'s loop:

```ts
for (const slot of proposal.slots) {
  if (slot.candidate === null) continue

  const candidate = byNumber.get(slot.candidate)
  if (candidate === undefined) {
    throw new Error(`Candidate ${slot.candidate} is not in the index.`)
  }

  if (used.has(candidate.id)) throw new DuplicateProposalError()
  used.add(candidate.id)

  slots.push({
    day: slot.day,
    meal: slot.meal,
    course: candidate.course,
    recipeId: candidate.id,
  })
}
```

and its signature's second parameter:

```ts
export function resolveProposal(
  proposal: MenuProposal,
  byNumber: Map<number, { id: string; course: Course }>
): ProposedMenuSlot[] {
```

In `loadCandidates`, add `course: true` to the `db.recipe.findMany` select (after `title: true`), and `course: recipe.course,` to the returned object (after `title`).

- [ ] **Step 8: Run the proposal tests**

Run:

```
pnpm exec vitest run lib/services/menu-proposal.test.ts
```

Expected: PASS.

- [ ] **Step 9: Verify and commit**

Run:

```
pnpm verify
```

Expected: clean. `replaceWeekSlots` still takes `{ day, meal, recipeId }[]` and a `ProposedMenuSlot[]` is structurally assignable to it, so `generateWeek` compiles unchanged — Task 4 tightens that.

```
pnpm exec prettier --write lib/services/menu-candidates.ts lib/services/menu-candidates.test.ts lib/services/menu-proposal.ts lib/services/menu-proposal.test.ts
```

```bash
git add -A
git commit -m "feat: a proposed slot knows which course it is"
```

---

### Task 4: `MenuSlot.course` and the grid

Deliverable: a meal holds up to three slots, filled by hand, each picking from the recipes of its own course.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_slot_course/migration.sql`
- Modify: `lib/schemas/menu.ts`
- Modify: `lib/services/menus.ts`, `lib/services/menus.test.ts`
- Modify: `app/(app)/menu/[weekStart]/actions.ts`, `app/(app)/menu/[weekStart]/page.tsx`
- Modify: `components/menu/week-grid.tsx`, `components/menu/day-block.tsx`, `components/menu/slot-drawer.tsx`, `components/menu/recipe-picker.tsx`

**Interfaces:**

- Consumes: `COURSES`, `Course`, `COURSE_LABELS`, `courseRank`; `CourseSchema`; `ProposedMenuSlot.course` from Task 3; `RecipeSummary.course` from Task 2.
- Produces: `SlotAddress = { day: number; meal: Meal; course: Course }`; `sortSlots(stored: readonly MenuSlotView[]): MenuSlotView[]`; `setSlot(weekStart: Date, address: SlotAddress, input: SlotInput): Promise<void>`; `clearSlot(weekStart: Date, address: SlotAddress): Promise<void>`; `replaceWeekSlots(weekStart: Date, slots: readonly { day: number; meal: Meal; course: Course; recipeId: string }[]): Promise<void>`.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, change `model MenuSlot`:

```prisma
model MenuSlot {
  id       String   @id @default(cuid())
  menuId   String
  menu     Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  day      Int
  meal     MealType
  // Which of the meal's three courses this row occupies. Authoritative for the
  // grid: the recipe's own course only filters the picker, so the insalatona
  // can be tonight's contorno. See the 2026-08-30 design document, section 3.1.
  course   Course
  recipeId String?
  recipe   Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  freeText String?
  servings Int?

  @@unique([menuId, day, meal, course])
}
```

- [ ] **Step 2: Create the migration without applying it**

Run:

```
pnpm exec prisma migrate dev --create-only --name slot_course
```

- [ ] **Step 3: Replace the generated SQL**

Overwrite `prisma/migrations/<timestamp>_slot_course/migration.sql` with:

```sql
-- Every slot that exists today is the meal's only dish, and the middle of the
-- three is where it belongs. The default goes as soon as it has done that job.
ALTER TABLE "MenuSlot" ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "MenuSlot" ALTER COLUMN "course" DROP DEFAULT;

DROP INDEX "MenuSlot_menuId_day_meal_key";
CREATE UNIQUE INDEX "MenuSlot_menuId_day_meal_course_key"
  ON "MenuSlot" ("menuId", "day", "meal", "course");
```

No collision is possible: the index being dropped already forbade two rows sharing `[menuId, day, meal]`, so no two rows can collide once they all take the same course.

- [ ] **Step 4: Apply it and regenerate the client**

Run:

```
pnpm db:migrate && pnpm db:generate
```

- [ ] **Step 5: Add the address schema**

In `lib/schemas/menu.ts`, add the import:

```ts
import { CourseSchema } from "@/lib/schemas/course"
```

and, after `WeekStartSchema`:

```ts
// The three fields that address a slot within its week. Parsed as one object
// because none of them means anything without the others.
export const SlotAddressSchema = z.object({
  day: DaySchema,
  meal: MealSchema,
  course: CourseSchema,
})

export type SlotAddress = z.infer<typeof SlotAddressSchema>
```

`SlotInputSchema` is not touched: the course addresses the slot, it is not part of its contents.

- [ ] **Step 6: Write the failing `sortSlots` test**

Replace the whole `describe("buildWeekSlots", …)` block in `lib/services/menus.test.ts` — all five cases — with the block below, and change the import at the top of the file from `buildWeekSlots` to `sortSlots`. Add `course: "SECOND"` to the `stored` fixture, after `meal`.

```ts
describe("sortSlots", () => {
  it("orders by day first", () => {
    const sorted = sortSlots([stored({ day: 3 }), stored({ day: 1 })])

    expect(sorted.map((slot) => slot.day)).toEqual([1, 3])
  })

  it("puts lunch before dinner within a day", () => {
    const sorted = sortSlots([
      stored({ meal: "DINNER" }),
      stored({ meal: "LUNCH" }),
    ])

    expect(sorted.map((slot) => slot.meal)).toEqual(["LUNCH", "DINNER"])
  })

  it("orders a meal the way it is eaten, not alphabetically", () => {
    const sorted = sortSlots([
      stored({ course: "SIDE" }),
      stored({ course: "SECOND" }),
      stored({ course: "FIRST" }),
    ])

    expect(sorted.map((slot) => slot.course)).toEqual([
      "FIRST",
      "SECOND",
      "SIDE",
    ])
  })

  it("returns only what it was given — an empty week is empty, not fourteen", () => {
    expect(sortSlots([])).toEqual([])
  })

  it("does not mutate its argument", () => {
    const input = [stored({ day: 3 }), stored({ day: 1 })]
    sortSlots(input)

    expect(input[0].day).toBe(3)
  })
})
```

The `isListStale` describe block below it stays exactly as it is.

- [ ] **Step 7: Run it and watch it fail**

Run:

```
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: FAIL — `sortSlots` is not exported.

- [ ] **Step 8: Rewrite the menu service**

In `lib/services/menus.ts`:

Add the import:

```ts
import { courseRank, type Course } from "@/lib/courses"
```

and change the schema import to bring in `SlotAddress`:

```ts
import type { Meal, SlotAddress, SlotInput } from "@/lib/schemas/menu"
```

`MEAL_TYPES` and `DAYS_IN_WEEK` are no longer used here — remove both imports if nothing else in the file needs them, or `eslint` will fail on the unused binding.

Add `course` to `MenuSlotView`, after `meal`:

```ts
course: Course
```

Delete `keyOf` and the whole `buildWeekSlots` function, and put this in their place:

```ts
const MEAL_RANK: Record<Meal, number> = { LUNCH: 0, DINNER: 1 }

/**
 * Orders a week's slots the way the grid reads them.
 *
 * Exported for its own test, and a copy rather than a sort in place: the array
 * it is handed comes straight from a query and callers do not expect it to move
 * underneath them.
 *
 * The three ranks are explicit rather than an `orderBy` on the enum columns.
 * Postgres does order an enum by its declaration order, so the query would
 * work — but that makes the grid's order depend on the order of three lines in
 * the schema, with nothing on screen to say so.
 *
 * @param stored The slots the week holds, in any order.
 * @returns The same slots, by day, then lunch before dinner, then by course.
 */
export function sortSlots(stored: readonly MenuSlotView[]): MenuSlotView[] {
  return [...stored].sort(
    (a, b) =>
      a.day - b.day ||
      MEAL_RANK[a.meal] - MEAL_RANK[b.meal] ||
      courseRank(a.course) - courseRank(b.course)
  )
}
```

Rewrite `getMenuWeek`:

```ts
/**
 * Reads the slots one week holds.
 *
 * Sparse by design: a meal has three courses and typically not three dishes, so
 * only the rows that exist come back. Every one of them is a filled row, because
 * `setSlot` deletes a slot whose fields are all empty.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns The week's slots, by day, then lunch before dinner, then by course.
 */
export async function getMenuWeek(weekStart: Date): Promise<MenuSlotView[]> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slots: {
        select: {
          day: true,
          meal: true,
          course: true,
          recipeId: true,
          freeText: true,
          servings: true,
          recipe: { select: { title: true } },
        },
      },
    },
  })

  return sortSlots(
    (menu?.slots ?? []).map(({ recipe, ...slot }) => ({
      ...slot,
      recipeTitle: recipe?.title ?? null,
    }))
  )
}
```

Change `setSlot`'s signature and its two `db` calls. Its `@param day` and `@param meal` TSDoc lines become one:

```ts
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param address Which day, meal and course the slot occupies.
 * @param input The validated slot contents.
```

```ts
export async function setSlot(
  weekStart: Date,
  address: SlotAddress,
  input: SlotInput
): Promise<void> {
  if (
    input.recipeId === null &&
    input.freeText === null &&
    input.servings === null
  ) {
    return clearSlot(weekStart, address)
  }

  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    update: { slotsUpdatedAt: new Date() },
    select: { id: true },
  })

  try {
    await db.menuSlot.upsert({
      where: { menuId_day_meal_course: { menuId: menu.id, ...address } },
      create: { menuId: menu.id, ...address, ...input },
      update: input,
    })
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}
```

Keep the comment above the empty-input branch as it is.

`clearSlot` likewise:

```ts
export async function clearSlot(
  weekStart: Date,
  address: SlotAddress
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { id: true },
  })

  if (menu === null) return

  await db.$transaction([
    db.menuSlot.deleteMany({ where: { menuId: menu.id, ...address } }),
    db.menu.update({
      where: { id: menu.id },
      data: { slotsUpdatedAt: new Date() },
    }),
  ])
}
```

Its `@param day` and `@param meal` lines become `@param address Which day, meal and course the slot occupies.` Keep the one-transaction comment.

`replaceWeekSlots` — widen the parameter type and the `createMany` payload:

```ts
export async function replaceWeekSlots(
  weekStart: Date,
  slots: readonly {
    day: number
    meal: Meal
    course: Course
    recipeId: string
  }[]
): Promise<void> {
```

```ts
      db.menuSlot.createMany({
        data: slots.map((slot) => ({
          menuId: menu.id,
          day: slot.day,
          meal: slot.meal,
          course: slot.course,
          recipeId: slot.recipeId,
        })),
      }),
```

`isWeekEmpty` is unchanged.

- [ ] **Step 9: Run the menu service tests**

Run:

```
pnpm exec vitest run lib/services/menus.test.ts
```

Expected: PASS, `isListStale`'s three cases included.

- [ ] **Step 10: Put the course in the slot address of the action**

In `app/(app)/menu/[weekStart]/actions.ts`:

Change the schema import to bring in `SlotAddressSchema` in place of `DaySchema` and `MealSchema`:

```ts
import {
  SlotAddressSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
```

Replace `addressFrom`:

```ts
// The four fields that address the slot, parsed together: none of them is
// meaningful without the others.
function addressFrom(formData: FormData) {
  return {
    weekStart: WeekStartSchema.safeParse(formData.get("weekStart")),
    address: SlotAddressSchema.safeParse({
      day: optionalNumber(formData.get("day")),
      meal: formData.get("meal"),
      course: formData.get("course"),
    }),
  }
}
```

In `saveSlot`, replace the guard and the call:

```ts
if (!address.weekStart.success || !address.address.success) {
  return failure("Questo slot non esiste.", { values })
}
```

```ts
await setSlot(address.weekStart.data, address.address.data, input.data)
```

`generateWeek` needs no edit: `proposeMenu` now returns the course and `replaceWeekSlots` now requires it.

- [ ] **Step 11: Update the page**

In `app/(app)/menu/[weekStart]/page.tsx`:

Replace the `filledSlots` computation and its comment:

```tsx
// Generating replaces the week, so the button asks first when there is
// something to lose. Every stored slot is a filled one — setSlot deletes a
// slot whose fields are all empty — so the count is the length. The server
// re-reads it regardless, because a hidden or disabled button guards nothing.
const filledSlots = slots.length
```

and give the picker the course:

```tsx
        recipes={recipes.map(({ id, title, course }) => ({
          id,
          title,
          course,
        }))}
```

- [ ] **Step 12: Widen `RecipeOption`**

In `components/menu/recipe-picker.tsx`:

```ts
import type { Course } from "@/lib/courses"

export type RecipeOption = { id: string; title: string; course: Course }
```

Nothing else in that file changes: the filtering happens in the drawer, which is what decides what "fits this slot" means.

- [ ] **Step 13: Rewrite the drawer**

Replace `components/menu/slot-drawer.tsx` with:

```tsx
"use client"

import { useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { FormDrawer } from "@/components/page/form-drawer"
import { FormField } from "@/components/page/form-field"
import { NumberField, TextField } from "@/components/page/fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useFormState } from "@/hooks/use-form-state"
import { COURSE_LABELS, type Course } from "@/lib/courses"
import type { FormAction } from "@/lib/form"

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  course: Course
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

const FIELD_ORDER = ["freeText", "servings"] as const

export function SlotDrawer({
  open,
  onClose,
  slot,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
}: {
  open: boolean
  onClose: () => void
  slot: SlotDrawerValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  const form = useFormState(saveAction, FIELD_ORDER, {
    freeText: slot.freeText ?? "",
    servings: slot.servings === null ? "" : String(slot.servings),
  })

  const [picked, setPicked] = useState<RecipeOption | null>(
    slot.recipeId === null || slot.recipeTitle === null
      ? null
      : (recipes.find((recipe) => recipe.id === slot.recipeId) ?? null)
  )

  const [showAll, setShowAll] = useState(false)

  // The recipe already in the slot stays listed whatever its course, or a
  // cross-course assignment would vanish from its own picker the moment the
  // drawer reopened.
  const offered = showAll
    ? recipes
    : recipes.filter(
        (recipe) => recipe.course === slot.course || recipe.id === picked?.id
      )

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      form={form}
      title={`${dayLabel} · ${mealLabel} · ${COURSE_LABELS[slot.course]}`}
      description="Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina. Svuota i campi per liberare lo slot."
      submitLabel="Salva"
      pendingLabel="Salvo…"
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="day" value={slot.day} />
      <input type="hidden" name="meal" value={slot.meal} />
      <input type="hidden" name="course" value={slot.course} />
      <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

      <FormField
        name="recipe"
        label="Ricetta"
        description="Scrivi per filtrare il ricettario. La ✕ la toglie."
      >
        <RecipePicker
          id="recipe"
          recipes={offered}
          value={picked}
          onSelect={setPicked}
          aria-describedby="recipe-description"
        />
        {/* The escape hatch the filter needs. A slot that can only ever hold
            its own course would be the same trap as one dish per meal, only
            smaller — design section 3.1. */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-all"
            checked={showAll}
            onCheckedChange={setShowAll}
          />
          <Label htmlFor="show-all" className="text-xs font-normal">
            Mostra tutte le ricette
          </Label>
        </div>
      </FormField>

      <TextField
        {...form.fieldProps("freeText")}
        label="Oppure una nota"
        error={form.errorOf("freeText")}
        description="Una nota non finisce nella lista della spesa."
        autoComplete="off"
        placeholder="fuori a cena…"
      />

      <NumberField
        {...form.fieldProps("servings")}
        label="Porzioni"
        error={form.errorOf("servings")}
        description="Lascia vuoto per le porzioni di casa."
        min={1}
        max={20}
        autoComplete="off"
      />
    </FormDrawer>
  )
}
```

Base UI's `onCheckedChange` is `(checked: boolean, eventDetails) => void`, so `setShowAll` can be passed straight in: a handler that takes fewer parameters than the type declares is assignable. The `Checkbox` in `components/ui/checkbox.tsx` already carries `after:-inset-x-3 after:-inset-y-2`, which is what gives a 16px box a real tap target.

- [ ] **Step 14: Rewrite the day block**

Replace `components/menu/day-block.tsx` with:

```tsx
import { BookOpen, Plus } from "lucide-react"
import Link from "next/link"

import type { SlotDrawerValues } from "@/components/menu/slot-drawer"
import { Card } from "@/components/ui/card"
import { COURSES, COURSE_LABELS, type Course } from "@/lib/courses"

const TAP =
  "rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"

const MEALS = [
  { meal: "LUNCH", label: "Pranzo" },
  { meal: "DINNER", label: "Cena" },
] as const

// Two controls side by side rather than one: a link inside a button is invalid
// markup, and the whole point is that they lead to different places — the
// drawer that changes the slot, and the recipe itself.
function SlotRow({
  slot,
  onOpen,
}: {
  slot: SlotDrawerValues
  onOpen: () => void
}) {
  const content = slot.recipeTitle ?? slot.freeText

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-14 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left ${TAP}`}
      >
        <span className="text-xs text-muted-foreground">
          {COURSE_LABELS[slot.course]}
        </span>
        {/* A row with neither a recipe nor a note still exists when it carries
            only servings, or when the recipe behind it was deleted and the
            foreign key set to null. Rare, and not a reason to render nothing. */}
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

      {/* Only where there is a recipe to open. Free text has no page, and the
          title is tested too because it is what names the link. */}
      {slot.recipeId === null || slot.recipeTitle === null ? null : (
        <Link
          href={`/recipes/${slot.recipeId}`}
          aria-label={`Apri la ricetta ${slot.recipeTitle}`}
          className={`flex w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground ${TAP}`}
        >
          <BookOpen aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  )
}

// One chip per course the meal does not hold. A meal is typically one or two
// dishes, so rendering the three empty rows as well would triple the height of
// the week for gaps nobody intends to fill.
function AddChip({
  course,
  mealLabel,
  dayLabel,
  onAdd,
}: {
  course: Course
  mealLabel: string
  dayLabel: string
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Aggiungi un ${COURSE_LABELS[course].toLowerCase()} a ${mealLabel} di ${dayLabel}`}
      className={`flex min-h-11 items-center gap-1 rounded-full border border-dashed border-input px-3 text-xs text-muted-foreground hover:text-foreground ${TAP}`}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {COURSE_LABELS[course]}
    </button>
  )
}

function MealBlock({
  day,
  meal,
  mealLabel,
  dayLabel,
  slots,
  onOpen,
}: {
  day: number
  meal: "LUNCH" | "DINNER"
  mealLabel: string
  dayLabel: string
  slots: SlotDrawerValues[]
  onOpen: (day: number, meal: "LUNCH" | "DINNER", course: Course) => void
}) {
  const missing = COURSES.filter(
    (course) => !slots.some((slot) => slot.course === course)
  )

  return (
    <section aria-label={`${mealLabel} — ${dayLabel}`}>
      <h3 className="px-3 pt-2 text-xs font-medium text-muted-foreground">
        {mealLabel}
      </h3>
      {slots.map((slot) => (
        <SlotRow
          key={slot.course}
          slot={slot}
          onOpen={() => onOpen(slot.day, slot.meal, slot.course)}
        />
      ))}
      {missing.length === 0 ? null : (
        <div className="flex flex-wrap gap-2 px-3 py-2">
          {missing.map((course) => (
            <AddChip
              key={course}
              course={course}
              mealLabel={mealLabel}
              dayLabel={dayLabel}
              onAdd={() => onOpen(day, meal, course)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function DayBlock({
  day,
  label,
  isToday,
  slots,
  onOpen,
}: {
  day: number
  label: string
  isToday: boolean
  slots: SlotDrawerValues[]
  onOpen: (day: number, meal: "LUNCH" | "DINNER", course: Course) => void
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
        {MEALS.map(({ meal, label: mealLabel }) => (
          <MealBlock
            key={meal}
            day={day}
            meal={meal}
            mealLabel={mealLabel}
            dayLabel={label}
            slots={slots.filter((slot) => slot.meal === meal)}
            onOpen={onOpen}
          />
        ))}
      </Card>
    </section>
  )
}
```

The file carries no `"use client"` directive today and still should not: it is imported by `week-grid.tsx`, which does, so it is already inside that boundary. Adding a second directive would say there are two boundaries when there is one.

- [ ] **Step 15: Rewrite the week grid**

Replace `components/menu/week-grid.tsx` with:

```tsx
"use client"

import { useCallback, useState } from "react"

import { DayBlock } from "@/components/menu/day-block"
import type { RecipeOption } from "@/components/menu/recipe-picker"
import {
  SlotDrawer,
  type SlotDrawerValues,
} from "@/components/menu/slot-drawer"
import type { Course } from "@/lib/courses"
import type { FormAction } from "@/lib/form"

type Address = { day: number; meal: "LUNCH" | "DINNER"; course: Course }

const keyOf = (address: Address) =>
  `${address.day}-${address.meal}-${address.course}`

// One drawer for the whole week rather than one per slot: the recipe list
// would otherwise be serialised into the payload forty-two times.
export function WeekGrid({
  weekStart,
  slots,
  dayLabels,
  todayIndex,
  recipes,
  saveAction,
}: {
  weekStart: string
  slots: SlotDrawerValues[]
  dayLabels: string[]
  // -1 when the week on screen is not the current one.
  todayIndex: number
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  // The address rather than the slot itself: a chip addresses a slot that does
  // not exist yet, and holding the address keeps the drawer reading from fresh
  // props for the one that does.
  const [address, setAddress] = useState<Address | null>(null)
  const close = useCallback(() => setAddress(null), [])

  const open: SlotDrawerValues | null =
    address === null
      ? null
      : (slots.find(
          (slot) =>
            slot.day === address.day &&
            slot.meal === address.meal &&
            slot.course === address.course
        ) ?? {
          ...address,
          recipeId: null,
          recipeTitle: null,
          freeText: null,
          servings: null,
        })

  return (
    <div className="flex flex-col gap-4">
      {dayLabels.map((label, day) => (
        <DayBlock
          key={day}
          day={day}
          label={label}
          isToday={day === todayIndex}
          slots={slots.filter((slot) => slot.day === day)}
          // Parameters named apart from the `day` of the enclosing map: the
          // chip's day is the one the caller passes, and shadowing it here is
          // how the two silently become the same thing when one of them moves.
          onOpen={(atDay, meal, course) =>
            setAddress({ day: atDay, meal, course })
          }
        />
      ))}

      {open === null || address === null ? null : (
        <SlotDrawer
          // Remounts when the slot changes, so the drawer's local picker state
          // never carries one slot's recipe into the next one.
          key={keyOf(address)}
          open={true}
          onClose={close}
          slot={open}
          weekStart={weekStart}
          dayLabel={dayLabels[open.day]}
          recipes={recipes}
          saveAction={saveAction}
        />
      )}
    </div>
  )
}
```

`keyOf` no longer identifies a stored slot — it keys the drawer's remount off the address, which is what makes a chip and the row it becomes two different drawers.

- [ ] **Step 16: Verify**

Run:

```
pnpm verify
```

Expected: clean. Then:

```
pnpm exec prettier --write prisma/schema.prisma lib/schemas/menu.ts lib/services/menus.ts lib/services/menus.test.ts "app/(app)/menu/[weekStart]/actions.ts" "app/(app)/menu/[weekStart]/page.tsx" components/menu/week-grid.tsx components/menu/day-block.tsx components/menu/slot-drawer.tsx components/menu/recipe-picker.tsx
```

- [ ] **Step 17: Check it in the browser at 390px**

On the running dev server, at `/menu/<a Monday>`:

1. An empty week shows every meal as three chips, and no chip row overflows at 390px.
2. Tapping "+ Primo" opens the drawer titled `… · Pranzo · Primo`, and the picker lists only recipes tagged Primo.
3. Ticking "Mostra tutte le ricette" makes the rest appear.
4. Saving a recipe turns the chip into a row and leaves the other two chips.
5. Filling all three leaves no chips.
6. Reopening a filled row shows its recipe in the picker.
7. Clearing the recipe, note and servings deletes the row and brings its chip back.
8. The book icon still opens the recipe.
9. `/shopping/<the same Monday>` regenerates and the list totals every course of the day.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "feat: a meal holds a primo, a secondo and a contorno"
```

---

### Task 5: Close the work

**Files:**

- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run the design review**

Invoke the `web-design-guidelines` skill over the files changed in Tasks 2 and 4:

```
components/menu/day-block.tsx
components/menu/week-grid.tsx
components/menu/slot-drawer.tsx
components/recipes/recipe-form.tsx
components/page/fields.tsx
app/(app)/recipes/page.tsx
app/(app)/recipes/[id]/page.tsx
```

Address each finding, or dismiss it in writing with a reason. UI work is not done until this has run — it is a working agreement in `CLAUDE.md`, not a suggestion. Pay particular attention to the chips: they are the one new interactive element, and they need a tap target of at least 44px, a visible focus ring, and an accessible name that says which course and which meal.

- [ ] **Step 2: Record it in the roadmap**

In `docs/roadmap.md`, add this row to the bottom of the **Shipped** table:

```
| [`2026-08-30-menu-courses`](superpowers/plans/2026-08-30-menu-courses.md) | `Course` on the recipe and on the slot, a meal that holds a primo, a secondo and a contorno, the grid gone sparse with a chip per gap, and `sortSlots` in place of `buildWeekSlots` |
```

Update the "Last updated" line to 2026-08-30, and add a short entry under **Not started** for the piece deliberately left undone:

> **Teach the proposal to compose three courses.** `proposeMenu` still returns one recipe per meal, written into the slot of its own course, so a generated week can come out all contorni. The prompt lives in the `LlmFunction` row and the candidate lines already carry the course, so this is a prompt change plus a wider `menuProposalSchema` — see `2026-08-30-menu-courses-design.md` §7.

Do not restate the design here; the roadmap records sequence and state and points at the documents.

- [ ] **Step 3: Final verification**

Run:

```
pnpm verify
```

Expected: clean. Report the output, not a claim about it.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "docs: record the courses work and what it left for the proposal"
git push -u origin feat/menu-courses
```

Note for whoever opens the pull request: this branch starts from `feat/ui-polish`, which has one commit that is not yet on `main`. The PR will contain both unless `feat/ui-polish` is merged first.

---

## Notes for the executor

**The migration order matters.** Task 2's migration creates the `Course` type; Task 4's only adds a column that uses it. Running them out of order fails.

**Do not add a consistency check between `MenuSlot.course` and `Recipe.course`.** It looks like an omission and is a decision — design §3.1. A composite foreign key or a service-side check would forbid using the insalatona as tonight's contorno, and a mismatch costs nothing downstream.

**Do not touch anything under `lib/services/shopping-*`.** The aggregator has never read the meal and must not start reading the course. If a shopping-list test fails, the cause is elsewhere.

**Do not change `lib/schemas/menu-proposal.ts`.** Its `SLOTS_IN_WEEK = 14` cap and its "two slots address the same day and meal" refinement both still hold, because the model still answers with one recipe per meal.
