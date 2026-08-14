# Ingredient Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text ingredient lines with a curated `Ingredient` catalogue, so a recipe line points at a known ingredient with a preferred unit and a supermarket aisle, and the shopping list aggregates on identity instead of on string similarity.

**Architecture:** A new `Ingredient` table carries the name, a free-text preferred unit and the aisle; `RecipeIngredient` gains a foreign key to it and loses its own `name` and `raw`. The recipe form becomes rows of _ingredient · unit · quantity_, where picking an ingredient fills the unit from the catalogue and moves focus to the quantity. The stock shadcn `combobox` provides both the ingredient picker and the tag chips. The learned-aisle table `IngredientAisle` disappears, because the aisle now lives on the ingredient.

**`Ingredient` is keyed on its name, not on a cuid.** Every other model here needs a surrogate key — two recipes may share a title. An ingredient may not: the name is unique by definition, the two users curate it, and it is the thing every other table wants to talk about. A natural key makes `RecipeIngredient.ingredientName` read in plain language in `db:studio` and in SQL, and removes a join from every debugging session. The one cost is renaming, which `onUpdate: Cascade` turns into an atomic database operation. Revisit only if ingredients ever acquire references from outside the database — a bookmarked URL, an export file — where a rename would break a link Postgres cannot see.

**This does not reintroduce string matching.** The old design compared _typed_ names through a normaliser and hoped. Here the name is chosen from a list and enforced by a foreign key, so two rows carrying the same name are the same catalogue entry by construction, not by resemblance.

**Existing data is discarded.** The user decided on 2026-08-14 to start clean rather than migrate the hand-typed test recipe. Task 1 deletes every `Recipe` before the schema changes, which is what keeps the migration a plain generated one with no hand-written backfill.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`base-mira` / `mist`).

**Spec:** `docs/superpowers/specs/2026-08-13-menu-spesa-design.md` — §5 (data model), §6.3 (shopping list generation), §4.3 (UI rules). This plan revises §5 and §6.3; Task 10 records the change.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited. Control sizing is whatever the registry generates.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; `nativeButton={false}` when `render` yields a non-button _and the component wraps the Base UI Button primitive_ — `SidebarMenuButton` and other `useRender` components do not take it.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth`. `lib/schemas/**` imports Zod and nothing else. ESLint fails the build on a violation.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param` (dotted for object members: `@param input`, then `@param input.field`), `@returns`, `@throws` where it throws. ESLint enforces it.
- **Italian for everything the user reads**, including every Zod message. English for identifiers, comments, TSDoc, commit messages.
- **Phone first at 390px.**
- **Theme tokens only.** No hex, no raw palette classes.
- **Use the page primitives** in `components/page/` — `PageHeader`, `DataList`, `DataListRow`, `EmptyState`, `PageError`, `ListSkeleton`, `DetailSkeleton`. Do not rebuild them. See `docs/conventions/ui.md`.
- **`pnpm verify` is the gate.** Typecheck + lint + tests, green before any task is done.

## Testing

`docs/conventions/testing.md` binds over the writing-plans skill's test-first default, and it cuts both ways here:

- **Tested, and test-first:** the Zod schemas, the ingredient service's pure helpers, and above all **the shopping-list aggregator**, which the convention names "the highest-value target in the project". Its 16 existing tests change shape in Task 8 and must stay green.
- **Not tested:** the React components. `vitest.config.ts` runs `environment: "node"` with no DOM, and the convention excludes presentational code. Those tasks verify with `pnpm verify` plus a written manual browser check.

## A shell hazard, before Task 1

If a commit fails with `"node" non è riconosciuto`, the shell was started before a bad `.asar` entry was removed from the Windows PATH. Restart the shell, or strip it for that command:

```bash
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v 'app\.asar' | paste -sd:)"
```

Never `--no-verify`.

---

## File Structure

**Created**

| File                                                          | Responsibility                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `prisma/migrations/*_ingredient_catalogue/migration.sql`      | the schema change, generated by Prisma                            |
| `prisma/ingredients.ts`                                       | the starter catalogue data, one array                             |
| `lib/schemas/ingredient.ts`                                   | Zod contract for an ingredient and for a recipe's ingredient rows |
| `lib/services/ingredients.ts`                                 | catalogue reads and creation                                      |
| `components/ingredients/ingredient-rows.tsx`                  | the row editor: ingredient · unit · quantity                      |
| `components/ingredients/ingredient-picker.tsx`                | one combobox with inline creation                                 |
| `components/ingredients/unit-input.tsx`                       | free-text unit with suggestions                                   |
| `components/recipes/tag-picker.tsx`                           | tags as chips, with inline creation                               |
| `components/ui/combobox.tsx`, `components/ui/input-group.tsx` | generated by the CLI                                              |

**Modified**

| File                                                           | Change                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | `Ingredient` added, `RecipeIngredient` re-pointed, `IngredientAisle` dropped |
| `prisma/seed.ts`                                               | seeds the catalogue                                                          |
| `lib/schemas/recipe.ts`                                        | `ingredients` becomes an array of rows, `tags` an array of strings           |
| `lib/services/recipes.ts`                                      | writes and reads ingredient rows through the FK                              |
| `lib/services/shopping-aggregate.ts`                           | keyed on ingredient id; the `aisles` argument disappears                     |
| `lib/services/shopping-aggregate.test.ts`                      | fixtures gain `aisle`; the `aisles` argument goes                            |
| `app/(app)/recipes/actions.ts`                                 | parses the row arrays and the tag array out of `FormData`                    |
| `components/recipes/recipe-form.tsx`                           | hosts the row editor and the tag picker                                      |
| `app/(app)/recipes/[id]/page.tsx`                              | renders _quantity unit name_ instead of the raw line                         |
| `docs/conventions/data.md`, `docs/conventions/ui.md`, the spec | record the decisions                                                         |

**Deleted**

- `lib/services/recipe-ingredients.ts` and its 7 tests. It converts a textarea blob into rows, and the textarea is what this plan removes. The URL import will need _parsed line → matched catalogue entry_, which is a different function.
- `prisma/schema.prisma`'s `IngredientAisle` model. Nothing in the code references it — only a comment in `lib/services/ingredient-name.ts`.

**Kept although currently uncalled**

- `lib/services/ingredient-parse.ts` and `lib/services/ingredient-name.ts`. After this plan nothing calls them, and that is deliberate: they are the engine of the URL import in spec §6.1, where an arbitrary string must be matched against the catalogue. Their fixture tables are exactly the tests `testing.md` asks for. Do not delete them; Task 10 records why they are there.

---

## Task 1: The Ingredient table

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_ingredient_catalogue/migration.sql` (generated by Prisma)

**Interfaces:**

- Consumes: nothing.
- Produces: `Ingredient { name (PK), defaultUnit, aisle }` and `RecipeIngredient { id, recipeId, ingredientName, quantity, unit, position }`.

- [ ] **Step 1: Discard the existing recipes**

The user decided to start clean rather than migrate the hand-typed test recipe. Emptying the table first is also what keeps the migration a plain generated one: with no rows, dropping `name` and `raw` and adding a required `ingredientName` needs no backfill and raises no data-loss prompt.

```bash
echo 'DELETE FROM "Recipe";' | pnpm exec prisma db execute --stdin
```

`RecipeIngredient` cascades from `Recipe`, so this empties both. `MenuSlot.recipeId` is `SetNull` and there are no menus yet.

- [ ] **Step 2: Edit the schema**

In `prisma/schema.prisma`, delete the whole `IngredientAisle` model and its two comment lines, then replace the `RecipeIngredient` model and add `Ingredient`:

```prisma
// The curated catalogue. Keyed on the name, which is unique by definition and
// is what every other table wants to talk about — see the plan header for why
// this one model does not carry a surrogate key. `defaultUnit` is free text on
// purpose: a hint that pre-fills a recipe row, not a controlled vocabulary.
// `aisle` lives here rather than in a learned lookup, so it is set once per
// ingredient and the shopping list groups correctly from then on.
model Ingredient {
  name        String             @id
  defaultUnit String?
  aisle       String             @default("altro")
  usedIn      RecipeIngredient[]
}

model RecipeIngredient {
  id             String     @id @default(cuid())
  recipeId       String
  recipe         Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  ingredientName String
  // Restrict on delete: removing an ingredient still used by a recipe must fail
  // loudly rather than quietly empty the recipe. Cascade on update: renaming an
  // ingredient is a legitimate edit, and Postgres rewrites the references
  // atomically, which is what makes a natural key safe here.
  ingredient     Ingredient @relation(fields: [ingredientName], references: [name], onDelete: Restrict, onUpdate: Cascade)
  quantity       Float?
  unit           String?
  position       Int

  // The aggregation loads every ingredient of every selected recipe at once.
  @@index([recipeId])
  @@index([ingredientName])
}
```

Also add the back-relation to `Recipe` if Prisma asks for it — `ingredients RecipeIngredient[]` is already there.

- [ ] **Step 3: Create the migration and read it before applying**

```bash
pnpm exec prisma migrate dev --name ingredient_catalogue --create-only
```

Read the generated `migration.sql`. It should drop `IngredientAisle`, create `Ingredient` with `name` as the primary key, drop `RecipeIngredient.name` and `.raw`, and add `ingredientName` with a foreign key carrying `ON DELETE RESTRICT ON UPDATE CASCADE`.

If it instead drops and recreates `RecipeIngredient` wholesale, that is fine — the table is empty. If it warns about data loss, Step 1 did not run.

- [ ] **Step 4: Apply it and regenerate the client**

```bash
pnpm exec prisma migrate dev
pnpm db:generate
```

Expected: "Your database is now in sync with your schema", and the client regenerates into `lib/generated/prisma`.

- [ ] **Step 5: Verify**

```bash
pnpm verify
```

Expected: **typecheck fails**, in `lib/services/recipes.ts` and `lib/services/recipe-ingredients.ts`, because `RecipeIngredient.name` and `.raw` no longer exist. That is the correct state at this point — the callers are rewritten in Task 6. Record the failing file list and move on; do **not** patch them here.

If anything _else_ fails, stop.

- [ ] **Step 6: Commit**

```bash
git add prisma
git commit -m "feat: key recipe lines to an ingredient catalogue"
```

---

## Task 2: Seed the catalogue

**Files:**

- Create: `prisma/ingredients.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**

- Consumes: the `Ingredient` model from Task 1.
- Produces: `INGREDIENTS: { name: string; defaultUnit: string | null; aisle: string }[]` exported from `prisma/ingredients.ts`.

**Aisle values must come from `AISLE_ORDER`** in `lib/aisles.ts`: `ortofrutta`, `panetteria`, `macelleria`, `pescheria`, `salumi e formaggi`, `banco frigo`, `surgelati`, `dispensa`, `bevande`, `casa e pulizia`, `altro`. A typo produces an ingredient that sorts into the catch-all, silently.

- [ ] **Step 1: Write the catalogue**

Create `prisma/ingredients.ts`:

```ts
// The starter catalogue. It is data, not code: add to it freely, and expect the
// two users to keep adding from inside the app. `defaultUnit` is the unit that
// pre-fills a recipe row; null means the ingredient is normally counted.
// Aisles must be values from AISLE_ORDER in lib/aisles.ts.
export const INGREDIENTS: {
  name: string
  defaultUnit: string | null
  aisle: string
}[] = [
  { name: "aglio", defaultUnit: "spicchio", aisle: "ortofrutta" },
  { name: "basilico", defaultUnit: "foglia", aisle: "ortofrutta" },
  { name: "carote", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "cipolla", defaultUnit: null, aisle: "ortofrutta" },
  { name: "funghi champignon", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "insalata", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "limoni", defaultUnit: null, aisle: "ortofrutta" },
  { name: "melanzane", defaultUnit: null, aisle: "ortofrutta" },
  { name: "patate", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "peperoni", defaultUnit: null, aisle: "ortofrutta" },
  { name: "pomodori", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "pomodorini", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "prezzemolo", defaultUnit: "mazzetto", aisle: "ortofrutta" },
  { name: "rosmarino", defaultUnit: "rametto", aisle: "ortofrutta" },
  { name: "salvia", defaultUnit: "foglia", aisle: "ortofrutta" },
  { name: "sedano", defaultUnit: "gambo", aisle: "ortofrutta" },
  { name: "spinaci", defaultUnit: "g", aisle: "ortofrutta" },
  { name: "zucchine", defaultUnit: null, aisle: "ortofrutta" },
  { name: "mele", defaultUnit: null, aisle: "ortofrutta" },
  { name: "banane", defaultUnit: null, aisle: "ortofrutta" },
  { name: "arance", defaultUnit: null, aisle: "ortofrutta" },

  { name: "pane", defaultUnit: "g", aisle: "panetteria" },
  { name: "pane grattugiato", defaultUnit: "g", aisle: "panetteria" },
  { name: "piadine", defaultUnit: null, aisle: "panetteria" },
  { name: "pasta sfoglia", defaultUnit: "rotolo", aisle: "panetteria" },
  { name: "pasta brisée", defaultUnit: "rotolo", aisle: "panetteria" },

  { name: "petto di pollo", defaultUnit: "g", aisle: "macelleria" },
  { name: "cosce di pollo", defaultUnit: "g", aisle: "macelleria" },
  { name: "macinato di manzo", defaultUnit: "g", aisle: "macelleria" },
  { name: "salsiccia", defaultUnit: "g", aisle: "macelleria" },
  { name: "arista di maiale", defaultUnit: "g", aisle: "macelleria" },
  { name: "fettine di vitello", defaultUnit: "g", aisle: "macelleria" },

  { name: "gamberi", defaultUnit: "g", aisle: "pescheria" },
  { name: "salmone", defaultUnit: "g", aisle: "pescheria" },
  { name: "orata", defaultUnit: null, aisle: "pescheria" },
  { name: "vongole", defaultUnit: "g", aisle: "pescheria" },
  { name: "calamari", defaultUnit: "g", aisle: "pescheria" },

  { name: "prosciutto crudo", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "prosciutto cotto", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "speck", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "guanciale", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "pancetta", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "parmigiano", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "pecorino", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "mozzarella", defaultUnit: null, aisle: "salumi e formaggi" },
  { name: "burrata", defaultUnit: null, aisle: "salumi e formaggi" },
  { name: "philadelphia", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "ricotta", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "gorgonzola", defaultUnit: "g", aisle: "salumi e formaggi" },
  { name: "scamorza", defaultUnit: "g", aisle: "salumi e formaggi" },

  { name: "uova", defaultUnit: null, aisle: "banco frigo" },
  { name: "latte", defaultUnit: "ml", aisle: "banco frigo" },
  { name: "panna da cucina", defaultUnit: "ml", aisle: "banco frigo" },
  { name: "burro", defaultUnit: "g", aisle: "banco frigo" },
  { name: "yogurt bianco", defaultUnit: "g", aisle: "banco frigo" },

  { name: "piselli surgelati", defaultUnit: "g", aisle: "surgelati" },
  { name: "spinaci surgelati", defaultUnit: "g", aisle: "surgelati" },
  { name: "gelato", defaultUnit: "g", aisle: "surgelati" },

  { name: "spaghetti", defaultUnit: "g", aisle: "dispensa" },
  { name: "penne", defaultUnit: "g", aisle: "dispensa" },
  { name: "fusilli", defaultUnit: "g", aisle: "dispensa" },
  { name: "riso", defaultUnit: "g", aisle: "dispensa" },
  { name: "riso carnaroli", defaultUnit: "g", aisle: "dispensa" },
  { name: "farina 00", defaultUnit: "g", aisle: "dispensa" },
  { name: "zucchero", defaultUnit: "g", aisle: "dispensa" },
  { name: "sale", defaultUnit: "g", aisle: "dispensa" },
  { name: "pepe nero", defaultUnit: "g", aisle: "dispensa" },
  { name: "olio extravergine di oliva", defaultUnit: "ml", aisle: "dispensa" },
  { name: "aceto balsamico", defaultUnit: "ml", aisle: "dispensa" },
  { name: "passata di pomodoro", defaultUnit: "ml", aisle: "dispensa" },
  { name: "pomodori pelati", defaultUnit: "barattolo", aisle: "dispensa" },
  { name: "pomodorini secchi", defaultUnit: "g", aisle: "dispensa" },
  { name: "olive nere", defaultUnit: "barattolo", aisle: "dispensa" },
  { name: "capperi", defaultUnit: "g", aisle: "dispensa" },
  { name: "tonno in scatola", defaultUnit: "lattina", aisle: "dispensa" },
  { name: "ceci", defaultUnit: "barattolo", aisle: "dispensa" },
  { name: "fagioli borlotti", defaultUnit: "barattolo", aisle: "dispensa" },
  { name: "lenticchie", defaultUnit: "g", aisle: "dispensa" },
  { name: "brodo vegetale", defaultUnit: "ml", aisle: "dispensa" },
  { name: "lievito di birra", defaultUnit: "bustina", aisle: "dispensa" },
  { name: "lievito per dolci", defaultUnit: "bustina", aisle: "dispensa" },
  { name: "noce moscata", defaultUnit: "g", aisle: "dispensa" },
  { name: "origano", defaultUnit: "g", aisle: "dispensa" },
  { name: "peperoncino", defaultUnit: null, aisle: "dispensa" },
  { name: "cioccolato fondente", defaultUnit: "g", aisle: "dispensa" },
  { name: "mandorle", defaultUnit: "g", aisle: "dispensa" },
  { name: "pinoli", defaultUnit: "g", aisle: "dispensa" },
  { name: "miele", defaultUnit: "g", aisle: "dispensa" },
  { name: "senape", defaultUnit: "cucchiaio", aisle: "dispensa" },

  { name: "vino bianco", defaultUnit: "ml", aisle: "bevande" },
  { name: "vino rosso", defaultUnit: "ml", aisle: "bevande" },
  { name: "acqua frizzante", defaultUnit: "l", aisle: "bevande" },
  { name: "birra", defaultUnit: "ml", aisle: "bevande" },
]
```

- [ ] **Step 2: Seed it**

In `prisma/seed.ts`, add the import at the top with the others:

```ts
import { INGREDIENTS } from "./ingredients"
```

and inside `main()`, after the user loop, before the `console.log`:

```ts
// Upsert on the name, so re-seeding never duplicates and never clobbers an
// aisle the user has since corrected in the app.
for (const ingredient of INGREDIENTS) {
  await db.ingredient.upsert({
    where: { name: ingredient.name },
    update: {},
    create: ingredient,
  })
}
```

Change the final log to:

```ts
console.log(
  `Seeded ${USERS.length} users and ${INGREDIENTS.length} ingredients.`
)
```

`update: {}` is deliberate: re-running the seed adds what is missing and touches nothing that exists, so a corrected aisle survives.

- [ ] **Step 3: Run the seed**

```bash
pnpm exec prisma db seed
```

Expected: `Seeded 2 users and 94 ingredients.`

- [ ] **Step 4: Check the aisles are real**

Every `aisle` must be a value from `AISLE_ORDER` in `lib/aisles.ts`. A typo does not fail anything — `aisleRank` silently ranks an unknown aisle with the catch-all — so check it here rather than discovering it in a shopping list:

```bash
echo 'SELECT DISTINCT aisle FROM "Ingredient" ORDER BY aisle;' | pnpm exec prisma db execute --stdin
```

`db execute` prints no rows, so read the values in `pnpm db:studio` instead and compare them against `AISLE_ORDER` by eye. Expected: only `ortofrutta`, `panetteria`, `macelleria`, `pescheria`, `salumi e formaggi`, `banco frigo`, `surgelati`, `dispensa`, `bevande`.

- [ ] **Step 5: Verify**

```bash
pnpm verify
```

Expected: the same typecheck failures as Task 1 and no new ones.

- [ ] **Step 6: Commit**

```bash
git add prisma
git commit -m "feat: seed a starter ingredient catalogue"
```

---

## Task 3: The ingredient service

**Files:**

- Create: `lib/services/ingredients.ts`

**Interfaces:**

- Consumes: the `Ingredient` model.
- Produces:
  - `type IngredientOption = { name: string; defaultUnit: string | null }`
  - `listIngredients(): Promise<IngredientOption[]>`
  - `listUsedUnits(): Promise<string[]>`
  - `createIngredient(name: string): Promise<IngredientOption>`
  - `findIngredientByName(name: string): Promise<IngredientOption | null>`
  - `class IngredientExistsError extends Error`

- [ ] **Step 1: Write the failing test**

Create `lib/services/ingredients.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { rankUnitsByUse } from "@/lib/services/ingredients"

describe("rankUnitsByUse", () => {
  it("puts the most used unit first", () => {
    expect(
      rankUnitsByUse([
        { unit: "ml", uses: 2 },
        { unit: "g", uses: 9 },
      ])
    ).toEqual(["g", "ml"])
  })

  it("breaks a tie alphabetically, so the order is stable between requests", () => {
    expect(
      rankUnitsByUse([
        { unit: "pz", uses: 3 },
        { unit: "g", uses: 3 },
      ])
    ).toEqual(["g", "pz"])
  })

  it("drops nulls, because an unquantified line has no unit to suggest", () => {
    expect(
      rankUnitsByUse([
        { unit: null, uses: 7 },
        { unit: "g", uses: 1 },
      ])
    ).toEqual(["g"])
  })

  it("drops blank and whitespace-only units", () => {
    expect(
      rankUnitsByUse([
        { unit: "  ", uses: 5 },
        { unit: "g", uses: 1 },
      ])
    ).toEqual(["g"])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test -- lib/services/ingredients.test.ts
```

Expected: FAIL — `rankUnitsByUse` is not exported from that module (the module does not exist).

- [ ] **Step 3: Write the service**

Create `lib/services/ingredients.ts`:

```ts
import { db } from "@/lib/db"

/** Thrown by `createIngredient` when the name is already in the catalogue. */
export class IngredientExistsError extends Error {
  constructor(name: string) {
    super(`An ingredient named ${name} already exists.`)
    this.name = "IngredientExistsError"
  }
}

export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

// Prisma's unique-constraint failure (P2002), read structurally so this module
// never imports a Prisma type outside lib/db.ts.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

/**
 * Orders units by how often recipes use them, most used first.
 *
 * Exported for its own test: the ranking is the only logic in this module that
 * is worth asserting without a database.
 *
 * @param rows One entry per distinct unit, with the number of rows using it.
 * @returns The unit names, most used first, ties broken alphabetically.
 */
export function rankUnitsByUse(
  rows: { unit: string | null; uses: number }[]
): string[] {
  return rows
    .filter((row): row is { unit: string; uses: number } => {
      return typeof row.unit === "string" && row.unit.trim().length > 0
    })
    .sort((a, b) => b.uses - a.uses || a.unit.localeCompare(b.unit, "it"))
    .map((row) => row.unit)
}

/**
 * Lists the whole catalogue, alphabetically.
 *
 * The catalogue is small — hundreds of rows at most — so it is loaded whole and
 * filtered in the browser rather than queried per keystroke.
 *
 * @returns Every ingredient, ordered by name.
 */
export async function listIngredients(): Promise<IngredientOption[]> {
  return db.ingredient.findMany({
    select: { name: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Finds one catalogue entry by its exact name.
 *
 * Matching is exact, not normalised: the name is a primary key, and the caller
 * either picked it from the catalogue or just created it.
 *
 * @param name The exact ingredient name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function findIngredientByName(
  name: string
): Promise<IngredientOption | null> {
  return db.ingredient.findUnique({
    where: { name },
    select: { name: true, defaultUnit: true },
  })
}

/**
 * Lists the units recipes actually use, most used first.
 *
 * Feeds the suggestions on the unit field, so the common three sit at the top
 * and a one-off unit stays possible.
 *
 * @returns The distinct non-empty units, most used first.
 */
export async function listUsedUnits(): Promise<string[]> {
  const rows = await db.recipeIngredient.groupBy({
    by: ["unit"],
    _count: { unit: true },
  })

  return rankUnitsByUse(
    rows.map((row) => ({ unit: row.unit, uses: row._count.unit }))
  )
}

/**
 * Adds an ingredient to the catalogue from the recipe form.
 *
 * Created without a unit or an aisle: the aisle defaults to the catch-all and
 * is corrected later, because interrupting a recipe to classify a supermarket
 * aisle is how a form gets abandoned.
 *
 * @param name The ingredient name, already trimmed and validated by the caller.
 * @returns The new catalogue entry.
 * @throws IngredientExistsError When the name is already in the catalogue.
 */
export async function createIngredient(
  name: string
): Promise<IngredientOption> {
  try {
    return await db.ingredient.create({
      data: { name },
      select: { name: true, defaultUnit: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new IngredientExistsError(name)
    throw error
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm test -- lib/services/ingredients.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Verify**

```bash
pnpm verify
```

Expected: the same pre-existing typecheck failures from Task 1, no new ones, and 104 tests where the run reaches them.

- [ ] **Step 6: Commit**

```bash
git add lib/services/ingredients.ts lib/services/ingredients.test.ts
git commit -m "feat: add the ingredient catalogue service"
```

---

## Task 4: The Zod contract

**Files:**

- Create: `lib/schemas/ingredient.ts`
- Modify: `lib/schemas/recipe.ts`
- Modify: `lib/schemas/recipe.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `INGREDIENT_NAME_MAX = 120`, `UNIT_MAX = 30`
  - `IngredientNameSchema` — trimmed, 1..120
  - `RecipeIngredientRowSchema` → `{ ingredientName: string; unit: string | null; quantity: number | null }`
  - `RecipeInputSchema.ingredients: RecipeIngredientRow[]` (at least one)
  - `RecipeInputSchema.tags: string[]`

**The foreign key is validated by the same schema as the name**, because with a natural key they are the same string. Zod checks the shape; the foreign key checks that the ingredient exists, and Task 6 turns that failure into a message.

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/ingredient.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  IngredientNameSchema,
  RecipeIngredientRowSchema,
} from "@/lib/schemas/ingredient"

describe("IngredientNameSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(IngredientNameSchema.parse("  farina 00  ")).toBe("farina 00")
  })

  it("rejects a name that is only whitespace", () => {
    const result = IngredientNameSchema.safeParse("   ")
    expect(result.success).toBe(false)
  })

  it("reports in Italian", () => {
    const result = IngredientNameSchema.safeParse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Il nome dell’ingrediente non può essere vuoto."
      )
    }
  })
})

describe("RecipeIngredientRowSchema", () => {
  it("keeps a quantity and a unit", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: 320,
      })
    ).toEqual({ ingredientName: "spaghetti", unit: "g", quantity: 320 })
  })

  it("turns an empty unit into null, so it is absent rather than blank", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "uova",
        unit: "  ",
        quantity: 2,
      }).unit
    ).toBeNull()
  })

  it("accepts a row with no quantity — the q.b. case", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "sale",
        unit: null,
        quantity: null,
      }).quantity
    ).toBeNull()
  })

  it("rejects a negative quantity", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: -1,
      }).success
    ).toBe(false)
  })

  it("rejects a zero quantity, which would ask for nothing", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: 0,
      }).success
    ).toBe(false)
  })

  it("rejects a row with no ingredient", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "",
        unit: "g",
        quantity: 1,
      }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm test -- lib/schemas/ingredient.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the schema**

Create `lib/schemas/ingredient.ts`:

```ts
import { z } from "zod"

export const INGREDIENT_NAME_MAX = 120
export const UNIT_MAX = 30

export const IngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Il nome dell’ingrediente non può essere vuoto.")
  .max(
    INGREDIENT_NAME_MAX,
    `Il nome dell’ingrediente può avere al massimo ${INGREDIENT_NAME_MAX} caratteri.`
  )

// An empty unit is absent, not blank: the aggregator treats "" and null
// differently, and a blank string would open a second line for the same thing.
const unit = z
  .string()
  .trim()
  .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
  .nullable()
  .transform((value) => (value === null || value === "" ? null : value))

export const RecipeIngredientRowSchema = z.object({
  // The foreign key is the name, so the same constraints apply — only the
  // empty-row message differs, because here it means "you left a row blank".
  ingredientName: IngredientNameSchema.min(1, "Scegli un ingrediente."),
  unit,
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
})

export type RecipeIngredientRow = z.infer<typeof RecipeIngredientRowSchema>
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm test -- lib/schemas/ingredient.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Re-shape the recipe schema**

In `lib/schemas/recipe.ts`, add the import at the top:

```ts
import { RecipeIngredientRowSchema } from "@/lib/schemas/ingredient"
```

Replace the `tags` field with:

```ts
  // Free-form labels chosen from the ones already used, or typed in. §12.2
  // keeps normalisation shallow until a duplicate is a nuisance.
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Un’etichetta non può essere vuota.")
        .max(50, "Un’etichetta può avere al massimo 50 caratteri.")
    )
    .max(20, "Al massimo 20 etichette.")
    .default([]),
```

Replace the `ingredients` field with:

```ts
  ingredients: z
    .array(RecipeIngredientRowSchema)
    .min(1, "Serve almeno un ingrediente.")
    .max(100, "Al massimo 100 ingredienti per ricetta."),
```

`lib/schemas/` may import Zod only — but `@/lib/schemas/ingredient` is itself a schema module, so this import is allowed. ESLint will confirm.

- [ ] **Step 6: Update the recipe schema tests**

In `lib/schemas/recipe.test.ts`, every fixture currently passes `ingredients` as a string and `tags` as a comma-separated string. Change each to the new shapes: `ingredients: [{ ingredientName: "spaghetti", unit: "g", quantity: 320 }]` and `tags: ["veloce"]`. Any test that asserted on comma splitting or on the ingredients-as-text length limit no longer describes the contract — delete those and keep the rest.

Add one test for each new constraint:

```ts
it("rejects a recipe with no ingredients", () => {
  const result = RecipeInputSchema.safeParse({
    ...valid,
    ingredients: [],
  })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues[0].message).toBe("Serve almeno un ingrediente.")
  }
})

it("rejects a blank tag", () => {
  expect(
    RecipeInputSchema.safeParse({ ...valid, tags: ["veloce", " "] }).success
  ).toBe(false)
})
```

using whatever the file already names its valid fixture.

- [ ] **Step 7: Verify**

```bash
pnpm verify
```

Expected: the schema tests pass; the only typecheck failures are still the Task 1 ones in `lib/services/recipes.ts`, `lib/services/recipe-ingredients.ts`, plus now `app/(app)/recipes/actions.ts` and the recipe form, which still build the old shapes. All four are rewritten in Task 6.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas
git commit -m "feat: make ingredients and tags structured in the recipe contract"
```

---

## Task 5: The row editor

**Files:**

- Create: `components/ui/combobox.tsx`, `components/ui/input-group.tsx` (via CLI)
- Create: `components/ingredients/ingredient-picker.tsx`
- Create: `components/ingredients/unit-input.tsx`
- Create: `components/ingredients/ingredient-rows.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks at compile time — it takes its data as props.
- Produces:
  - `type IngredientOption = { name: string; defaultUnit: string | null }` — declared locally, structurally matching the service's, because `components/**` may not import `lib/services/**`.
  - `type IngredientRowValue = { key: string; ingredientName: string; unit: string; quantity: string }` — no separate display name: with a natural key the foreign key _is_ the label.
  - `IngredientRows({ options, units, defaultRows, onCreateIngredient })`
  - `IngredientPicker({ options, value, onSelect, onCreate, inputRef })`
  - `UnitInput({ id, name, value, onChange, units })`

**Why these are controlled.** `vercel-react-best-practices` prefers uncontrolled inputs. Rows are the exception: they are added and removed at runtime, so React must own the list, and a React-owned list is also what makes the row values survive React 19's form reset without the echo dance the flat fields need. A handful of rows is cheap per keystroke.

**The wire format.** Each row renders three inputs with the _same_ names across rows — `ingredientName`, `unit`, `quantity` — so the action reads three parallel arrays with `formData.getAll(...)`. Every row always renders all three, including empty ones, so the arrays stay the same length and index-aligned. Do not switch to indexed names like `ingredientName-0`; the parallel arrays are what keeps the action simple.

- [ ] **Step 1: Install the combobox**

```bash
pnpm dlx shadcn@latest add combobox
```

It pulls `input-group` and reuses `button`. Then:

```bash
git status --short
pnpm typecheck
```

Expected: `components/ui/combobox.tsx` and `components/ui/input-group.tsx` created.

If the CLI runs a package install, the git hooks may be rewritten — see "A shell hazard" above.

- [ ] **Step 2: Write the ingredient picker**

Create `components/ingredients/ingredient-picker.tsx`:

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

export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

export function IngredientPicker({
  options,
  value,
  onSelect,
  onCreate,
  "aria-label": ariaLabel,
}: {
  options: IngredientOption[]
  value: IngredientOption | null
  onSelect: (option: IngredientOption) => void
  onCreate: (name: string) => void
  "aria-label": string
}) {
  const [query, setQuery] = useState("")
  const trimmed = query.trim()
  const isNew =
    trimmed.length > 0 &&
    !options.some(
      (option) => option.name.toLowerCase() === trimmed.toLowerCase()
    )

  return (
    <Combobox
      items={options}
      itemToStringLabel={(option: IngredientOption) => option.name}
      value={value}
      onValueChange={(option: IngredientOption | null) => {
        if (option !== null) onSelect(option)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxInput aria-label={ariaLabel} placeholder="Ingrediente" />
      <ComboboxContent>
        <ComboboxEmpty>
          {isNew ? (
            <button
              type="button"
              className="w-full px-2 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => onCreate(trimmed)}
            >
              Crea «{trimmed}»
            </button>
          ) : (
            "Nessun ingrediente."
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {(option: IngredientOption) => (
            <ComboboxItem key={option.name} value={option}>
              {option.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

Base UI's `Combobox` filters `items` against the input itself. Read `.agents/skills/shadcn/rules/base-vs-radix.md` and the Base UI combobox API at `https://base-ui.com/react/components/combobox.md` before adjusting prop names — if `itemToStringLabel` or the render-function child shape differs in this version, follow the installed `components/ui/combobox.tsx`, not this snippet, and say so in the task report.

- [ ] **Step 3: Write the unit input**

Create `components/ingredients/unit-input.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"

// A plain input with a datalist rather than a combobox: the unit is free text
// first and a suggestion second, and a datalist keeps typing an unlisted unit
// the default behaviour instead of a fight with a picker.
export function UnitInput({
  name,
  value,
  onChange,
  units,
  listId,
  "aria-label": ariaLabel,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  units: string[]
  listId: string
  "aria-label": string
}) {
  return (
    <>
      <Input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        aria-label={ariaLabel}
        placeholder="Unità"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listId}>
        {units.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  )
}
```

The `datalist` is rendered once per row and they all share the same option set; give every row the same `listId` from the parent so the browser parses one list, not N.

- [ ] **Step 4: Write the rows**

Create `components/ingredients/ingredient-rows.tsx`:

```tsx
"use client"

import { Trash2 } from "lucide-react"
import { useRef, useState } from "react"

import {
  IngredientPicker,
  type IngredientOption,
} from "@/components/ingredients/ingredient-picker"
import { UnitInput } from "@/components/ingredients/unit-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type IngredientRowValue = {
  key: string
  ingredientName: string
  unit: string
  quantity: string
}

const UNIT_LIST_ID = "unit-suggestions"

export function IngredientRows({
  options,
  units,
  defaultRows,
  onCreateIngredient,
}: {
  options: IngredientOption[]
  units: string[]
  defaultRows: IngredientRowValue[]
  onCreateIngredient: (name: string) => Promise<IngredientOption | null>
}) {
  const [rows, setRows] = useState<IngredientRowValue[]>(
    defaultRows.length > 0 ? defaultRows : [emptyRow()]
  )
  // Keys are minted here rather than from the index, so removing a middle row
  // does not make React reuse the wrong input's DOM state.
  const nextKey = useRef(rows.length)
  const quantityRefs = useRef(new Map<string, HTMLInputElement | null>())

  function emptyRowWithKey(): IngredientRowValue {
    nextKey.current += 1
    return { ...emptyRow(), key: `row-${nextKey.current}` }
  }

  const update = (key: string, patch: Partial<IngredientRowValue>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )

  function select(key: string, option: IngredientOption) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        // Only pre-fill an empty unit: overwriting a unit the user just typed
        // would undo a deliberate choice. Building the next row explicitly,
        // rather than spreading a partial patch, because a patch carrying
        // `unit: undefined` would blank the field instead of leaving it.
        const unit =
          row.unit === "" && option.defaultUnit !== null
            ? option.defaultUnit
            : row.unit
        return { ...row, ingredientName: option.name, unit }
      })
    )
    quantityRefs.current.get(key)?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <IngredientPicker
              options={options}
              value={
                row.ingredientName === ""
                  ? null
                  : { name: row.ingredientName, defaultUnit: null }
              }
              onSelect={(option) => select(row.key, option)}
              onCreate={async (name) => {
                const created = await onCreateIngredient(name)
                if (created !== null) select(row.key, created)
              }}
              aria-label={`Ingrediente ${index + 1}`}
            />
            <input
              type="hidden"
              name="ingredientName"
              value={row.ingredientName}
            />
          </div>

          <div className="w-20 shrink-0">
            <UnitInput
              name="unit"
              value={row.unit}
              onChange={(unit) => update(row.key, { unit })}
              units={units}
              listId={UNIT_LIST_ID}
              aria-label={`Unità dell’ingrediente ${index + 1}`}
            />
          </div>

          <div className="w-20 shrink-0">
            <Input
              name="quantity"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={row.quantity}
              onChange={(event) =>
                update(row.key, { quantity: event.target.value })
              }
              ref={(element) => {
                quantityRefs.current.set(row.key, element)
              }}
              aria-label={`Quantità dell’ingrediente ${index + 1}`}
              placeholder="Qtà"
              autoComplete="off"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Togli l’ingrediente ${index + 1}`}
            disabled={rows.length === 1}
            onClick={() =>
              setRows((current) => current.filter((r) => r.key !== row.key))
            }
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => setRows((current) => [...current, emptyRowWithKey()])}
      >
        Aggiungi ingrediente
      </Button>
    </div>
  )
}

function emptyRow(): IngredientRowValue {
  return { key: "row-0", ingredientName: "", unit: "", quantity: "" }
}
```

An explicit "Aggiungi ingrediente" button rather than a ghost row that materialises on typing: on a phone a ghost row gets created by a stray touch, and a button is predictable.

The delete button is disabled on the last remaining row, because the schema requires at least one ingredient and a form that can reach an unsubmittable state is a trap.

- [ ] **Step 5: Verify**

```bash
pnpm verify
```

Expected: these three files typecheck and lint. The Task 1 failures in `lib/services/recipes.ts` and the others are still there.

- [ ] **Step 6: Commit**

```bash
git add components/ui components/ingredients
git commit -m "feat: add the ingredient row editor"
```

---

## Task 6: The switch

**Files:**

- Delete: `lib/services/recipe-ingredients.ts`, `lib/services/recipe-ingredients.test.ts`
- Modify: `lib/services/recipes.ts`
- Modify: `app/(app)/recipes/actions.ts`
- Modify: `components/recipes/recipe-form.tsx`
- Modify: `components/recipes/recipe-form-state.ts`
- Modify: `app/(app)/recipes/new/page.tsx`, `app/(app)/recipes/[id]/edit/page.tsx`, `app/(app)/recipes/[id]/page.tsx`

**Interfaces:**

- Consumes: everything from Tasks 3, 4 and 5.
- Produces: a working recipe form on the new data shape. This is the task that makes `pnpm verify` green again.

This is the largest task in the plan and it is deliberately not split: between the schema change and here, the app does not compile, so a smaller cut would produce a task that cannot be verified.

- [ ] **Step 1: Delete the textarea glue**

```bash
git rm lib/services/recipe-ingredients.ts lib/services/recipe-ingredients.test.ts
```

- [ ] **Step 2: Re-point the recipe service**

In `lib/services/recipes.ts`:

Remove the `ingredientRowsFrom` import. Change `RecipeDetail`'s `ingredients` member to:

```ts
ingredients: {
  id: string
  ingredientName: string
  quantity: number | null
  unit: string | null
}
;[]
```

In `toColumns`, replace the ingredient mapping with:

```ts
    ingredients: {
      create: input.ingredients.map((row, position) => ({
        ingredientName: row.ingredientName,
        quantity: row.quantity,
        unit: row.unit,
        position,
      })),
    },
```

`position` comes from the array order, so the client never sends it and cannot send a duplicate.

In `getRecipe`, the ingredient selection needs **no join** — with a natural key the display name is the foreign key, already on the row:

```ts
      ingredients: {
        select: {
          id: true,
          ingredientName: true,
          quantity: true,
          unit: true,
        },
        orderBy: { position: "asc" },
      },
```

No post-mapping either: what Prisma returns is already the contract shape.

Add to the module a typed error and use it where the FK can fail:

```ts
/** Thrown when a recipe references an ingredient that is not in the catalogue. */
export class UnknownIngredientError extends Error {
  constructor() {
    super("A recipe line references an ingredient that does not exist.")
    this.name = "UnknownIngredientError"
  }
}
```

In both `createRecipe` and `updateRecipe`, wrap the write and translate Prisma's foreign-key failure (`P2003`, read structurally like `P2025` already is) into `UnknownIngredientError`.

- [ ] **Step 3: Parse the arrays in the action**

In `app/(app)/recipes/actions.ts`, add a reader above `saveRecipe`:

```ts
// The form renders one set of identically-named inputs per row, so the three
// arrays are index-aligned by DOM order. Every row always renders all three
// inputs, including empty ones, which is what keeps them the same length.
function ingredientRowsFrom(formData: FormData) {
  const names = formData.getAll("ingredientName")
  const units = formData.getAll("unit")
  const quantities = formData.getAll("quantity")

  return names.map((name, index) => ({
    ingredientName: typeof name === "string" ? name : "",
    unit: typeof units[index] === "string" ? (units[index] as string) : null,
    quantity: optionalNumber(quantities[index] ?? null) ?? null,
  }))
}
```

and a tag reader:

```ts
function tagsFrom(formData: FormData): string[] {
  return formData
    .getAll("tags")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}
```

In `saveRecipe`, replace the two lines that read `tags` and `ingredients` from `formData.get(...)` with `tags: tagsFrom(formData)` and `ingredients: ingredientRowsFrom(formData)`.

Add a `catch` for `UnknownIngredientError` alongside the existing `RecipeNotFoundError` branch, returning:

```ts
return {
  errors: {},
  message: "Uno degli ingredienti non esiste più. Ricaricala e riprova.",
  values: valuesFrom(formData),
}
```

Remove `"tags"` and `"ingredients"` from `FORM_FIELDS`: `valuesFrom` echoes flat strings, and these two are no longer flat. Their values survive React's form reset because Task 5's components hold them in React state, not in DOM defaults.

- [ ] **Step 4: Add the create-ingredient action**

In the same file:

```ts
export async function addIngredient(
  name: string
): Promise<{ name: string; defaultUnit: string | null } | null> {
  const parsed = IngredientNameSchema.safeParse(name)
  if (!parsed.success) return null

  await requireSession()

  try {
    return await createIngredient(parsed.data)
  } catch (error) {
    // Someone else added the same name between the search and the tap. The
    // caller's intent is satisfied by the existing row.
    if (error instanceof IngredientExistsError) {
      return await findIngredientByName(parsed.data)
    }
    throw error
  }
}
```

`findIngredientByName` comes from Task 3. Validate, then authenticate, then mutate — in that order, as the existing actions do.

- [ ] **Step 5: Rewrite the form**

In `components/recipes/recipe-form.tsx`:

Replace the `ingredients` `Field` with the row editor and the `tags` `Field` with the tag picker from Task 7 — for this task, render `IngredientRows` and leave the tags input as it is; Task 7 swaps it.

`RecipeFormValues` loses `ingredients: string` and gains `ingredients: IngredientRowValue[]`. Remove `"ingredients"` from `FIELD_ORDER`: the focus-first-error effect looks up `document.getElementById(field)`, and the rows have no single element with that id.

The ingredients `Field` becomes:

```tsx
<Field data-invalid={invalid("ingredients")}>
  <FieldLabel htmlFor="ingredients-heading">Ingredienti</FieldLabel>
  <div id="ingredients-heading" />
  <IngredientRows
    options={options}
    units={units}
    defaultRows={values.ingredients}
    onCreateIngredient={onCreateIngredient}
  />
  <FieldError id="ingredients-error">{errorOf("ingredients")}</FieldError>
</Field>
```

`FieldLabel` needs an `htmlFor` target, and the rows have no single control to point at — the empty anchor div is the honest way to keep the label a group heading rather than mislabelling the first picker, which already carries its own `aria-label`. If the design review in Task 9 prefers a `<fieldset>`/`<legend>` here, take that instead.

`RecipeForm` gains three props:

```tsx
export function RecipeForm({
  values,
  action,
  options,
  units,
  onCreateIngredient,
}: {
  values: RecipeFormValues
  action: SaveRecipeAction
  options: IngredientOption[]
  units: string[]
  onCreateIngredient: (name: string) => Promise<IngredientOption | null>
})
```

`onCreateIngredient` is passed in rather than imported, because `components/**` may not import from `app/**`. The pages pass `addIngredient`.

- [ ] **Step 6: Feed the pages**

`app/(app)/recipes/new/page.tsx` and `app/(app)/recipes/[id]/edit/page.tsx` are server components: each awaits `listIngredients()` and `listUsedUnits()` and passes them to `RecipeForm`.

Load them **in parallel with** the recipe, not after it:

```tsx
const [recipe, options, units] = await Promise.all([
  getRecipe(id),
  listIngredients(),
  listUsedUnits(),
])
```

A sequential await here is the waterfall `vercel-react-best-practices` ranks CRITICAL.

The edit page maps the recipe's ingredients into `IngredientRowValue[]`, minting a `key` per row from the row id.

- [ ] **Step 7: Render the detail page from the catalogue**

In `app/(app)/recipes/[id]/page.tsx`, the ingredients list rendered `{ingredient.raw}`, which no longer exists. Replace with a formatted line:

```tsx
<li key={ingredient.id}>
  {[
    ingredient.quantity === null ? null : ingredient.quantity,
    ingredient.unit,
    ingredient.name,
  ]
    .filter((part) => part !== null && part !== "")
    .join(" ")}
</li>
```

An ingredient with no quantity renders as just its name, which is the `q.b.` case reading correctly.

- [ ] **Step 8: Verify**

```bash
pnpm verify
```

Expected: **green**, for the first time since Task 1. If typecheck still fails, the failure names the remaining caller.

- [ ] **Step 9: Manual browser check**

At 390px, with `pnpm dev` running:

1. `/recipes/new` — one empty ingredient row is present, with an "Aggiungi ingrediente" button below.
2. Type `pom` in the ingredient field — the catalogue filters. Pick "pomodorini".
3. The unit fills with `g` **and the focus lands in the quantity field**. Type `500`.
4. Change the unit to `barattolo` by hand — the datalist offers the used units, and typing an unlisted one is accepted.
5. Tap "Aggiungi ingrediente" twice, fill one row, remove the empty one with its bin button. The remaining rows keep their own values — none shifted.
6. With one row left, the bin button is disabled.
7. Type a name that is not in the catalogue, e.g. `taleggio` — "Crea «taleggio»" appears; tap it, and the row fills with the new ingredient.
8. Save. The detail page lists `500 g pomodorini`, not a raw line.
9. Edit that recipe — every row comes back filled, in order.
10. **The reset check:** on the edit form, clear the recipe name and save. Validation fails, and **every ingredient row still holds what you entered**.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: pick recipe ingredients from the catalogue"
```

---

## Task 7: Tags as chips

**Files:**

- Create: `components/recipes/tag-picker.tsx`
- Modify: `components/recipes/recipe-form.tsx`
- Modify: `lib/services/recipes.ts` (add `listTags`)
- Modify: `app/(app)/recipes/new/page.tsx`, `app/(app)/recipes/[id]/edit/page.tsx`

**Interfaces:**

- Consumes: `Combobox` from Task 5.
- Produces: `TagPicker({ suggestions: string[], defaultTags: string[] })`, and `listTags(): Promise<string[]>` in `lib/services/recipes.ts`.

- [ ] **Step 1: List the tags already used**

Add to `lib/services/recipes.ts`, with a TSDoc block:

```ts
/**
 * Lists every tag any recipe already carries, alphabetically.
 *
 * Feeds the tag suggestions. Tags are a string array on Recipe rather than a
 * table, so this reads them all and flattens — fine at this size, and it keeps
 * a tag from needing a lifecycle of its own.
 *
 * @returns The distinct tags, sorted for Italian.
 */
export async function listTags(): Promise<string[]> {
  const rows = await db.recipe.findMany({ select: { tags: true } })
  return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) =>
    a.localeCompare(b, "it")
  )
}
```

- [ ] **Step 2: Write the picker**

Create `components/recipes/tag-picker.tsx`:

```tsx
"use client"

import { useState } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export function TagPicker({
  suggestions,
  defaultTags,
}: {
  suggestions: string[]
  defaultTags: string[]
}) {
  const [tags, setTags] = useState<string[]>(defaultTags)
  const [query, setQuery] = useState("")

  const trimmed = query.trim()
  const isNew =
    trimmed.length > 0 &&
    ![...suggestions, ...tags].some(
      (tag) => tag.toLowerCase() === trimmed.toLowerCase()
    )

  // Unlike an ingredient, a tag is not a row anywhere until the recipe is
  // saved, so creating one is local state and never a server round-trip.
  function add(tag: string) {
    setTags((current) => (current.includes(tag) ? current : [...current, tag]))
    setQuery("")
  }

  return (
    <>
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}

      <Combobox
        multiple
        items={suggestions}
        value={tags}
        onValueChange={setTags}
        inputValue={query}
        onInputValueChange={setQuery}
      >
        <ComboboxChips>
          {tags.map((tag) => (
            <ComboboxChip key={tag}>{tag}</ComboboxChip>
          ))}
          <ComboboxChipsInput
            aria-label="Etichette"
            placeholder={tags.length === 0 ? "Etichette" : undefined}
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>
            {isNew ? (
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => add(trimmed)}
              >
                Crea «{trimmed}»
              </button>
            ) : (
              "Nessuna etichetta."
            )}
          </ComboboxEmpty>
          <ComboboxList>
            {(tag: string) => (
              <ComboboxItem key={tag} value={tag}>
                {tag}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  )
}
```

The hidden inputs are what the action reads: `formData.getAll("tags")`. The combobox's own input is not named, so a half-typed word never submits as a tag.

If the installed `components/ui/combobox.tsx` exposes a different chips API than the one above, follow the file and report the difference — do not hand-write a substitute component.

- [ ] **Step 3: Wire it in**

Replace the tags `Input` in `components/recipes/recipe-form.tsx` with `TagPicker`, drop `"tags"` from `FIELD_ORDER`, and add `tagSuggestions: string[]` to `RecipeForm`'s props. Add `listTags()` to the `Promise.all` in both pages.

`RecipeFormValues.tags` becomes `string[]`.

- [ ] **Step 4: Verify**

```bash
pnpm verify
```

- [ ] **Step 5: Manual browser check**

1. On `/recipes/new`, the tag field shows existing tags when focused.
2. Selecting one adds a chip; the chip's × removes it.
3. Typing a new word offers "Crea «…»" and adds it as a chip.
4. Save, then edit — the chips come back.
5. The recipe list and detail still render the tags as badges.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: choose recipe tags as chips from the ones already used"
```

---

## Task 8: The aggregator, keyed on identity

**Files:**

- Modify: `lib/services/shopping-aggregate.ts`
- Modify: `lib/services/shopping-aggregate.test.ts`

**Interfaces:**

- Consumes: the `Ingredient` model's shape conceptually; imports nothing new.
- Produces:
  - `AggregatorIngredient = { name: string; aisle: string; quantity: number | null; unit: string | null }` — `aisle` added, nothing removed.
  - `aggregateShoppingList(input: { slots, existing })` — **the `aisles` member is gone**.
  - `ShoppingItem` is unchanged.

**The natural key makes this task small.** With a cuid the aggregator would have had to key on an id, carry a display name alongside it, and `ShoppingListItem` would have needed a new column before a generated list could round-trip. Keyed on the name, `itemKey(name, unit)` stays exactly as written, `ShoppingItem.name` already matches `ShoppingListItem.name`, and the only change to the contract is that the aisle now arrives with the ingredient instead of through a lookup table.

The names still are not compared loosely: they arrive from a foreign key into a curated catalogue, so two lines carrying the same name are the same ingredient by construction.

This is the task `testing.md` cares most about. Change the tests first.

- [ ] **Step 1: Change the tests to the new contract**

In `lib/services/shopping-aggregate.test.ts`, all 16 tests build fixtures. Give every ingredient fixture an `aisle`, and delete the `aisles: {...}` argument from every `aggregateShoppingList` call. Where a test asserted that an unknown name falls back to `AISLE_UNKNOWN`, the equivalent is now an ingredient whose own `aisle` is `"altro"` — keep the test and restate it that way.

Add one test for the property the catalogue now guarantees:

```ts
it("carries each ingredient's own aisle onto its line", () => {
  const result = aggregateShoppingList({
    slots: [
      slotWith([
        { name: "pomodorini", aisle: "ortofrutta", quantity: 200, unit: "g" },
        { name: "spaghetti", aisle: "dispensa", quantity: 320, unit: "g" },
      ]),
    ],
    existing: [],
  })
  // Sorted by walking order: ortofrutta comes before dispensa.
  expect(result.map((line) => line.aisle)).toEqual(["ortofrutta", "dispensa"])
})
```

using whatever helper the file already has for building a slot.

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm test -- lib/services/shopping-aggregate.test.ts
```

Expected: FAIL — typecheck errors on the fixtures and on the missing `aisles` argument.

- [ ] **Step 3: Rework the aggregator**

In `lib/services/shopping-aggregate.ts`:

- `itemKey` is unchanged. Keep the JSON encoding and the comment explaining why.
- `AggregatorIngredient` and `Total` gain `aisle`.
- `totalsFor` carries `aisle` through onto the total.
- The `aisles` parameter goes, and with it the `Object.hasOwn(aisles, …)` lookup: the line's aisle is `total.aisle`. The `AISLE_UNKNOWN` import is then unused here — `aisleRank` already handles an unrecognised value — so drop it from the import and keep `aisleRank`.
- `previous` is unchanged: it is already keyed by `itemKey(line.name, line.unit)`.
- Update the TSDoc: drop `@param input.aisles`, and say the aisle now travels with the ingredient. Keep the dotted `@param input` plus one per member — the lint rule requires both.

`Ingredient.aisle` defaults to `"altro"`, which is `AISLE_UNKNOWN`, so an ingredient nobody has classified still sorts with the catch-all exactly as before.

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm test -- lib/services/shopping-aggregate.test.ts
```

Expected: 17 passed.

- [ ] **Step 5: Verify**

```bash
pnpm verify
```

- [ ] **Step 6: Commit**

```bash
git add lib/services
git commit -m "feat: aggregate the shopping list on ingredient identity"
```

---

## Task 9: Design review

**Files:**

- Modify: whatever the review finds.

- [ ] **Step 1: Run the guidelines**

Use `.agents/skills/web-design-guidelines/` over:

```
components/ingredients/ingredient-rows.tsx
components/ingredients/ingredient-picker.tsx
components/ingredients/unit-input.tsx
components/recipes/tag-picker.tsx
components/recipes/recipe-form.tsx
app/(app)/recipes/new/page.tsx
app/(app)/recipes/[id]/edit/page.tsx
app/(app)/recipes/[id]/page.tsx
```

- [ ] **Step 2: Triage**

Fix focus order, keyboard reachability, labels, live regions, contrast, heading structure, long-content overflow.

Pay particular attention to two things this task's UI makes likely, and check them explicitly even if the tool does not raise them:

- **Every row control has an accessible name.** Three unlabelled inputs repeated N times is the worst case for a screen reader. Task 5 gives each an `aria-label` including the row number; confirm they survived.
- **Adding or removing a row is announced.** A visual user sees the row appear; a screen-reader user gets nothing. A polite live region reporting the row count is the cheap fix.

**Dismiss any finding about control or touch-target size**, naming the decision recorded in `docs/conventions/ui.md` under "Touch targets". Do not edit `components/ui/`.

If a finding needs a product decision, list it and stop.

- [ ] **Step 3: Verify and commit**

```bash
pnpm verify
git add -A
git commit -m "fix: address the design review of the ingredient rows"
```

---

## Task 10: Record the decisions

**Files:**

- Modify: `docs/superpowers/specs/2026-08-13-menu-spesa-design.md`
- Modify: `docs/conventions/data.md`

- [ ] **Step 1: Revise the spec's data model**

In §5, replace the `RecipeIngredient` block and delete `IngredientAisle`, matching the schema as built. Above the models, add:

```markdown
**Ingredients are a catalogue, not free text (decided 2026-08-14).** A recipe
line points at an `Ingredient`, which carries the name, a preferred unit and the
supermarket aisle. This replaces the original design's free-typed line plus a
learned `IngredientAisle` lookup, for three reasons: the shopping list then
aggregates on identity rather than on string similarity; the aisle is set once
per ingredient instead of per normalised name, so changing the normaliser can no
longer orphan it; and the two users curate the catalogue themselves, which was
the assumption the free-text design was hedging against.

The parser (`lib/services/ingredient-parse.ts`) and the name normaliser survive
uncalled. They are the engine of the URL import of §6.1, where a string arrives
from outside and must be matched against the catalogue — the one place an
heuristic still belongs.
```

- [ ] **Step 2: Revise §6.3**

The shopping-list generation steps refer to normalised names and a learned aisle lookup. Restate them in terms of `Ingredient.aisle`, leaving the rounding, sorting and checked-state rules exactly as they are — Task 8 did not change those. Note that the aggregator no longer takes an `aisles` argument.

- [ ] **Step 3: Record the natural key**

In `docs/conventions/data.md`, add:

```markdown
## `Ingredient` is keyed on its name

Every other model here carries a cuid, because every other model needs a
surrogate key — two recipes may share a title. An ingredient may not: the name
is unique by definition, the two users curate it, and it is what every other
table wants to talk about.

So `Ingredient.name` is the primary key and `RecipeIngredient.ingredientName`
is the foreign key. Three things follow, and none of them is an accident:

- Reading `RecipeIngredient` in `pnpm db:studio` or in psql needs no join.
- Renaming an ingredient is a normal edit. The relation carries
  `onUpdate: Cascade`, so Postgres rewrites every reference atomically.
- Deleting an ingredient a recipe still uses fails, by `onDelete: Restrict`.
  Emptying a recipe silently would be worse than an error.

Revisit only if ingredients acquire references from outside the database — a
bookmarked URL, an export file — where a rename would break a link Postgres
cannot see. Nothing does today.
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm verify
git add docs
git commit -m "docs: record the ingredient catalogue decision"
```

---

## Out of scope, deliberately

- **An admin screen for the catalogue.** Editing an ingredient's aisle or preferred unit happens in `pnpm db:studio` or by re-seeding until it hurts enough to build.
- **URL import.** Its own plan. It is why the parser survives.
- **The shopping list UI.** Task 8 leaves the aggregator correct and untested against a real menu, because no menu screen exists yet.
- **An end-to-end browser test.** Proposed on 2026-08-14 and **declined**: the user checks the visual and interaction behaviour by hand. Task 6 step 9 and Task 7 step 5 are written as the checklists for that, in order, with the expected result spelled out — including the React 19 form-reset case, which is the one no unit test in this project can reach.
- **The parked defects** — the focused `type="number"` revert on implicit Enter submit, the dev-only Base UI `useControlled` warnings, the English Zod default on `sourceUrl`'s `.max()`, the missing `touch-action`/`overscroll-behavior` in `app/globals.css`, the missing `env(safe-area-inset-*)`, and `autoComplete` on the flat form fields.
