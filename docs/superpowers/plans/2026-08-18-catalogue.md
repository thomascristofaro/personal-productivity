# Catalogue Implementation Plan (A of three)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ingredient catalogue into a catalogue of everything that can go on a shopping list — shampoo included — and make every name it stores lowercase.

**Architecture:** One Prisma model is renamed and grows a `kind`. Nothing else in the schema moves and no behaviour changes for recipes. The screens follow the model: `/ingredients` becomes `/catalogo`, with three chips filtering by kind and a `Tipo` field on the form. Lowercasing happens in the Zod schema, so the catalogue form, the recipe form and the shopping drawer all get it from one place.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI (`maia` / `olive` / `lime`).

**Spec:** `docs/superpowers/specs/2026-08-18-catalogue-and-purchases-design.md` — §3 (the rename and the migration), §4 (normalisation), §11 (the screens), §13 (testing). Read §3 before Task 1: it contains the SQL and the reason it is written by hand.

**This is plan A of three.** B (`2026-08-18-shopping-list-again.md`) and C (`2026-08-18-shopping-done.md`) both name `CatalogItem`, so this one lands first.

## Global Constraints

- **shadcn/ui is the only component library.** `pnpm dlx shadcn@latest add <component>`. Never re-run `init`. Never hand-write a base component. (`CLAUDE.md`)
- **Stay stock.** Nothing in `components/ui/` is edited by this plan.
- **Base UI, not Radix.** `render={<X />}`, never `asChild`; add `nativeButton={false}` when `render` yields a non-button.
- **Use the page primitives.** `PageHeader`, `EmptyState`, `PageError`, `ListSkeleton`, `DataList`, `DataListRow` in `components/page/`. Do not rebuild them and do not add a boolean prop to one.
- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `components/**` imports no `lib/services/**`, no `lib/db`, `lib/env`, `lib/auth`. `lib/schemas/**` imports Zod and its own siblings, nothing else. ESLint fails the build.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws`. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads**, including every Zod message. English for identifiers, comments, TSDoc, file names, commit messages.
- **Database names are English, database values stay Italian.** `CatalogItemKind.PRODUCT`; `aisle` holds `"ortofrutta"`.
- **Schema changes go through a migration.** Never edit the database by hand.
- **Phone first at 390px.** Theme tokens only, no hex, no raw palette classes.
- **`pnpm verify` is the gate.** Its output is the report; "it should work" is not.

## Testing

Per `docs/conventions/testing.md`: the Zod schemas and the pure functions are tested; React components are not — `vitest.config.ts` runs `environment: "node"` with no DOM. Prisma itself is not tested. Component tasks verify with `pnpm verify` plus the written browser check in Task 6.

## The shell

If a command fails with `"node" non è riconosciuto`, the Git Bash `PATH` carries a broken `app.asar` entry. Run `pnpm` through PowerShell, stripping it in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

`git commit` does not need it — the git hooks were removed on 2026-08-17. Never `--no-verify`.

---

## File Structure

**Created**

| File                                                | Responsibility                                    |
| --------------------------------------------------- | ------------------------------------------------- |
| `prisma/migrations/<ts>_catalog_item/migration.sql` | the hand-written rename and the `kind` column     |
| `lib/schemas/catalog.ts`                            | the catalogue contracts, lowercasing included     |
| `lib/schemas/catalog.test.ts`                       | covers them                                       |
| `lib/services/catalog.ts`                           | every catalogue read and write                    |
| `lib/services/catalog.test.ts`                      | `rankUnitsByUse`, `isKnownAisle`, `kindFilterFor` |
| `components/catalog/catalog-form.tsx`               | the create/edit form, now with `Tipo`             |
| `components/catalog/kind-filter.tsx`                | the three chips, links not buttons                |
| `app/(app)/catalogo/page.tsx`                       | the list, filtered by `?tipo=`                    |
| `app/(app)/catalogo/new/page.tsx`                   | create                                            |
| `app/(app)/catalogo/[name]/edit/page.tsx`           | edit and delete                                   |
| `app/(app)/catalogo/actions.ts`                     | `saveCatalogItem`, `removeCatalogItem`            |
| `app/(app)/catalogo/error.tsx`                      | delegates to `PageError`                          |
| `app/(app)/catalogo/loading.tsx`                    | delegates to `ListSkeleton`                       |
| `app/(app)/catalogo/[name]/edit/loading.tsx`        | delegates to `DetailSkeleton`                     |

**Deleted**

`lib/schemas/ingredient.ts`, `lib/schemas/ingredient.test.ts`, `lib/services/ingredients.ts`, `lib/services/ingredients.test.ts`, `components/ingredients/ingredient-form.tsx`, and the whole of `app/(app)/ingredients/`. They are moved, not lost — `git mv` where the content survives, so the history follows.

**Modified**

| File                                       | Change                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| `prisma/schema.prisma`                     | `Ingredient` → `CatalogItem`, `+kind`, `+CatalogItemKind`   |
| `prisma/catalog.ts` (was `ingredients.ts`) | renamed; the array gains no field — `kind` defaults         |
| `prisma/seed.ts`                           | `db.ingredient` → `db.catalogItem`, and the new import path |
| `lib/schemas/recipe.ts`                    | imports from `@/lib/schemas/catalog`                        |
| `lib/schemas/shopping.ts`                  | imports from `@/lib/schemas/catalog`; the name lowercases   |
| `lib/schemas/recipe.test.ts`               | nothing but the import, if it has one                       |
| `app/(app)/recipes/actions.ts`             | new module paths and the renamed exports                    |
| `app/(app)/recipes/new/page.tsx`           | `listIngredientOptions`                                     |
| `app/(app)/recipes/[id]/edit/page.tsx`     | `listIngredientOptions`                                     |
| `app/(app)/spesa/[weekStart]/page.tsx`     | `listCatalogOptions`                                        |
| `components/app-nav.tsx`                   | «Ingredienti» → «Catalogo», `/catalogo`                     |
| `docs/roadmap.md`                          | a row in Shipped                                            |

**Untracked, and still needing the edit**

`prisma/import/run.ts` and `prisma/import/verify.ts` call `db.ingredient`. The folder is git-ignored — see the roadmap — so the change is made locally and committed nowhere. Skipping it leaves the owner with a broken import script and no compile error to warn them, because `tsc` does not see git-ignored files that nothing imports.

---

## Task 1: The model becomes `CatalogItem`

Pure rename plus one column. Nothing the user can see changes, and the 108 catalogue rows and 127 recipe lines must all still be there afterwards.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_catalog_item/migration.sql`
- Modify: `lib/services/ingredients.ts` (nine `db.ingredient` call sites)
- Modify: `prisma/seed.ts:48`
- Modify (untracked): `prisma/import/run.ts:138,149`, `prisma/import/verify.ts:81,110`

**Interfaces:**

- Consumes: nothing.
- Produces: `db.catalogItem`, and `CatalogItemKind` with members `INGREDIENT` and `PRODUCT` in `lib/generated/prisma`. Every later task and both later plans depend on these names.

- [ ] **Step 1: Count what must survive**

Run, and write the two numbers down — Step 7 compares against them:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
node --conditions=react-server --import tsx -e "import { db } from './lib/db.ts'; console.log(await db.ingredient.count(), await db.recipeIngredient.count()); await db.`$disconnect()"
```

Expected at the time of writing: `108 127`.

- [ ] **Step 2: Edit the schema**

In `prisma/schema.prisma`, replace the `Ingredient` model with this, keeping the comment above it and updating its first line:

```prisma
enum CatalogItemKind {
  INGREDIENT
  PRODUCT
}

// The curated catalogue of everything that can go on a shopping list. Keyed on
// the name, which is unique by definition and is what every other table wants
// to talk about — see docs/conventions/data.md for why this one model carries
// no surrogate key. `kind` separates what a recipe may reference from what only
// the shopping list may: the picker inside the recipe form lists INGREDIENT and
// nothing else. `defaultUnit` is free text on purpose: a hint that pre-fills a
// recipe row, not a controlled vocabulary. `aisle` lives here rather than in a
// learned lookup, so it is set once per entry and the shopping list groups
// correctly from then on.
model CatalogItem {
  name        String             @id
  kind        CatalogItemKind    @default(INGREDIENT)
  defaultUnit String?
  aisle       String             @default("altro")
  usedIn      RecipeIngredient[]
}
```

In `model RecipeIngredient`, change only the relation's type — the field names stay, and §3 of the spec says why:

```prisma
  ingredient     CatalogItem @relation(fields: [ingredientName], references: [name], onDelete: Restrict, onUpdate: Cascade)
```

- [ ] **Step 3: Generate the migration without applying it**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:migrate --create-only --name catalog_item
```

Expected: a new folder under `prisma/migrations/`, containing SQL that **drops and recreates** the table. That is the wrong SQL and Step 4 replaces it. Do not apply it.

- [ ] **Step 4: Replace the SQL with the renames**

Overwrite the generated `migration.sql` with exactly this:

```sql
-- Renames rather than a drop and a create: the generated migration would take
-- the whole catalogue and every recipe line pointing at it. Postgres carries
-- the foreign key across a table rename by itself, and RecipeIngredient keeps
-- its column name, so it needs no statement here.
ALTER TABLE "Ingredient" RENAME TO "CatalogItem";

-- Not cosmetic. An index still named after the old table is what makes the next
-- `prisma migrate dev` believe the schema has drifted.
ALTER INDEX "Ingredient_pkey" RENAME TO "CatalogItem_pkey";

CREATE TYPE "CatalogItemKind" AS ENUM ('INGREDIENT', 'PRODUCT');

ALTER TABLE "CatalogItem"
  ADD COLUMN "kind" "CatalogItemKind" NOT NULL DEFAULT 'INGREDIENT';
```

- [ ] **Step 5: Apply it, and regenerate the client**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:migrate
pnpm db:generate
```

Expected: the migration applies, and Prisma reports the schema is in sync. If it instead offers to create _another_ migration, the SQL and the schema disagree — read what it wants to do before letting it do anything.

- [ ] **Step 6: Follow the rename through the code**

In `lib/services/ingredients.ts`, replace all nine occurrences of `db.ingredient.` with `db.catalogItem.`. Nothing else in the file changes yet — the exports keep their names until Task 3.

In `prisma/seed.ts:48`, the same substitution.

In the git-ignored `prisma/import/run.ts` and `prisma/import/verify.ts`, the same substitution at every `db.ingredient` (four call sites across the two files). Nothing here is committed.

- [ ] **Step 7: Verify nothing was lost, and that there is no drift**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
node --conditions=react-server --import tsx -e "import { db } from './lib/db.ts'; console.log(await db.catalogItem.count(), await db.recipeIngredient.count()); await db.`$disconnect()"
pnpm db:migrate
pnpm verify
```

Expected: the same two numbers as Step 1; `prisma migrate dev` reporting **"Already in sync, no schema change or pending migration"** and generating no new folder; then `pnpm verify` green.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts lib/services/ingredients.ts
git commit -m "feat: the ingredient catalogue becomes a catalogue of things to buy

Ingredient is renamed CatalogItem and grows a kind, so shampoo can have an
aisle and a default unit without a second table duplicating both. The migration
is hand-written: Prisma generates a DROP and a CREATE for a renamed model,
which would take the 108 catalogue rows and the 127 recipe lines pointing at
them.

RecipeIngredient keeps saying ingredientName. It is by definition about
ingredients, and renaming its column would rename a Zod field, a posted form
field and four test files' assertions without any of them reading better.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Names arrive lowercase

A name typed as `Pomodori` sorts and compares as a different thing from the ninety-two lowercase names the seed put there, and plan B's merge silently fails on the pair. Lowercasing goes in the schema, which is the one place all three forms pass through.

**Files:**

- Create: `lib/schemas/catalog.ts` (by `git mv` from `lib/schemas/ingredient.ts`)
- Create: `lib/schemas/catalog.test.ts` (by `git mv` from `lib/schemas/ingredient.test.ts`)
- Modify: `lib/schemas/recipe.ts`, `lib/schemas/shopping.ts`
- Modify: `lib/services/ingredients.ts`, `app/(app)/ingredients/actions.ts`, `app/(app)/recipes/actions.ts` — import paths and renamed exports

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces:
  - `CATALOG_NAME_MAX = 120`, `UNIT_MAX = 30`
  - `CatalogItemNameSchema: ZodType<string>` — trims, collapses inner whitespace, lowercases, rejects `/`
  - `CatalogItemKindSchema: ZodEnum<["INGREDIENT", "PRODUCT"]>`, `type CatalogItemKind = "INGREDIENT" | "PRODUCT"`
  - `CatalogItemInputSchema` → `{ name: string; kind: CatalogItemKind; defaultUnit: string | null; aisle: string }`, exported as `type CatalogItemInput`
  - `RecipeIngredientRowSchema` — **name and field names unchanged**, its `ingredientName` now built on `CatalogItemNameSchema`

- [ ] **Step 1: Move the two files**

```bash
git mv lib/schemas/ingredient.ts lib/schemas/catalog.ts
git mv lib/schemas/ingredient.test.ts lib/schemas/catalog.test.ts
```

- [ ] **Step 2: Write the failing tests**

Replace the `IngredientNameSchema` describe block in `lib/schemas/catalog.test.ts` with this, and update the import at the top of the file to `CatalogItemInputSchema, CatalogItemNameSchema, RecipeIngredientRowSchema` from `@/lib/schemas/catalog`:

```ts
describe("CatalogItemNameSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(CatalogItemNameSchema.parse("  farina 00  ")).toBe("farina 00")
  })

  it("lowercases, so a typed name matches the catalogue's own", () => {
    expect(CatalogItemNameSchema.parse("Pomodori")).toBe("pomodori")
  })

  it("lowercases every word, not only the first", () => {
    expect(CatalogItemNameSchema.parse("Grana Padano")).toBe("grana padano")
  })

  it("collapses inner whitespace, so two spaces cannot open a second entry", () => {
    expect(CatalogItemNameSchema.parse("cime  di   rapa")).toBe("cime di rapa")
  })

  it("is stable under a second application", () => {
    const once = CatalogItemNameSchema.parse("  Cime  Di Rapa ")
    expect(CatalogItemNameSchema.parse(once)).toBe(once)
  })

  it("rejects a name that is only whitespace", () => {
    expect(CatalogItemNameSchema.safeParse("   ").success).toBe(false)
  })

  it("rejects a slash, which would break the edit route's path segment", () => {
    expect(CatalogItemNameSchema.safeParse("olio/burro").success).toBe(false)
  })

  it("reports in Italian", () => {
    const result = CatalogItemNameSchema.safeParse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Il nome non può essere vuoto."
      )
    }
  })
})

describe("CatalogItemInputSchema", () => {
  it("defaults the kind to an ingredient, which is what most entries are", () => {
    expect(
      CatalogItemInputSchema.parse({
        name: "pomodori",
        defaultUnit: "g",
        aisle: "ortofrutta",
      }).kind
    ).toBe("INGREDIENT")
  })

  it("keeps a product", () => {
    expect(
      CatalogItemInputSchema.parse({
        name: "shampoo",
        kind: "PRODUCT",
        defaultUnit: null,
        aisle: "casa e pulizia",
      })
    ).toEqual({
      name: "shampoo",
      kind: "PRODUCT",
      defaultUnit: null,
      aisle: "casa e pulizia",
    })
  })

  it("rejects a kind nobody defined", () => {
    expect(
      CatalogItemInputSchema.safeParse({
        name: "shampoo",
        kind: "HOUSEHOLD",
        defaultUnit: null,
        aisle: "casa e pulizia",
      }).success
    ).toBe(false)
  })
})
```

In the existing `RecipeIngredientRowSchema` block, add one case:

```ts
it("lowercases the ingredient name, because it is a foreign key", () => {
  expect(
    RecipeIngredientRowSchema.parse({
      ingredientName: "Spaghetti",
      unit: "g",
      quantity: 320,
    }).ingredientName
  ).toBe("spaghetti")
})
```

- [ ] **Step 3: Run the tests and watch them fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/schemas/catalog.test.ts
```

Expected: FAIL — `CatalogItemNameSchema` is not exported.

- [ ] **Step 4: Rewrite the schema module**

`lib/schemas/catalog.ts` in full:

```ts
import { z } from "zod"

export const CATALOG_NAME_MAX = 120
export const UNIT_MAX = 30

export const CATALOG_ITEM_KINDS = ["INGREDIENT", "PRODUCT"] as const

// No custom message: the kind is chosen from a select the user cannot type
// into, so the only way to fail this is to call the action directly.
export const CatalogItemKindSchema = z.enum(CATALOG_ITEM_KINDS)
export type CatalogItemKind = z.infer<typeof CatalogItemKindSchema>

export const CatalogItemNameSchema = z
  .string()
  .trim()
  // Lowercase and single-spaced, so what the user types is the same key the
  // seed wrote. Without this, "Pomodori" is a second catalogue entry and the
  // shopping list shows two lines for one thing — design document section 4.
  .transform((value) => value.toLowerCase().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Il nome non può essere vuoto.")
      .max(
        CATALOG_NAME_MAX,
        `Il nome può avere al massimo ${CATALOG_NAME_MAX} caratteri.`
      )
      // The name addresses the entry in a URL path segment; an encoded slash is
      // decoded back into a separator and the route stops matching.
      .refine((value) => !value.includes("/"), {
        message: "Il nome non può contenere «/».",
      })
  )

// An empty unit is absent, not blank: the aggregator treats "" and null
// differently, and a blank string would open a second line for the same thing.
const unit = z
  .string()
  .trim()
  .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
  .nullable()
  .transform((value) => (value === null || value === "" ? null : value))

// A plain string, not an enum: lib/schemas may import Zod and its siblings, so
// AISLE_ORDER is out of reach. The service checks membership.
const aisle = z
  .string()
  .trim()
  .min(1, "Scegli un reparto.")
  .max(50, "Il reparto può avere al massimo 50 caratteri.")

export const RecipeIngredientRowSchema = z.object({
  // The foreign key is the name, so the same constraints apply — including the
  // lowercasing, or a recipe line points at a key the catalogue does not hold.
  ingredientName: CatalogItemNameSchema.pipe(
    z.string().min(1, "Scegli un ingrediente.")
  ),
  unit,
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
})

export type RecipeIngredientRow = z.infer<typeof RecipeIngredientRowSchema>

export const CatalogItemInputSchema = z.object({
  name: CatalogItemNameSchema,
  kind: CatalogItemKindSchema.default("INGREDIENT"),
  defaultUnit: unit,
  aisle,
})

export type CatalogItemInput = z.infer<typeof CatalogItemInputSchema>
```

- [ ] **Step 5: Run the tests and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/schemas/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Follow the renames through every importer**

`lib/schemas/recipe.ts`, `lib/schemas/shopping.ts`, `lib/services/ingredients.ts`, `app/(app)/ingredients/actions.ts` and `app/(app)/recipes/actions.ts` import from `@/lib/schemas/ingredient`. Change the path to `@/lib/schemas/catalog`, and the symbols:

| Was                     | Is now                   |
| ----------------------- | ------------------------ |
| `IngredientNameSchema`  | `CatalogItemNameSchema`  |
| `IngredientInputSchema` | `CatalogItemInputSchema` |
| `IngredientInput`       | `CatalogItemInput`       |
| `INGREDIENT_NAME_MAX`   | `CATALOG_NAME_MAX`       |

In `lib/schemas/shopping.ts`, `ManualItemSchema.name` currently builds its own string. Replace it so a manual line lowercases too — this is what makes plan B's merge work:

```ts
  // Not the whole CatalogItemNameSchema: a manual line need not exist in the
  // catalogue — "sacchetti" never will. The normalisation is shared all the
  // same, because the merge of design document section 6 keys on this name.
  name: CatalogItemNameSchema.pipe(
    z.string().min(1, "Scrivi che cosa serve.")
  ),
```

`lib/schemas/shopping.test.ts` asserts the old message for an empty name; if it does, update it to `"Scrivi che cosa serve."` and add:

```ts
it("lowercases the name, so it merges with a generated line", () => {
  expect(
    ManualItemSchema.parse({
      name: "Pomodori",
      aisle: "ortofrutta",
      quantity: 200,
      unit: "g",
    }).name
  ).toBe("pomodori")
})
```

- [ ] **Step 7: Run the gate**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Expected: green. If `tsc` reports an unresolved `@/lib/schemas/ingredient`, an importer was missed — the list in Step 6 is exhaustive as of 2026-08-18, but `grep -rn "schemas/ingredient" app components lib` settles it.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas app/\(app\)/ingredients/actions.ts app/\(app\)/recipes/actions.ts lib/services/ingredients.ts
git commit -m "feat: catalogue names are lowercased where they are validated

A name typed as Pomodori sorted and compared as a different thing from the
ninety-two lowercase names the seed wrote. Lowercasing lives in the Zod schema
rather than in a service, so the catalogue form, the recipe form and the
shopping drawer all get it from the same place and no route handler can forget.

This is not normaliseIngredientName. That additionally strips leading articles,
which is right when matching scraped prose and wrong as a rule for what a user
may name a thing.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The service becomes `catalog.ts`

**Files:**

- Create: `lib/services/catalog.ts` (by `git mv` from `lib/services/ingredients.ts`)
- Create: `lib/services/catalog.test.ts` (by `git mv` from `lib/services/ingredients.test.ts`)
- Modify: every importer — `app/(app)/ingredients/actions.ts`, `app/(app)/ingredients/{page,new/page,[name]/edit/page}.tsx`, `app/(app)/recipes/actions.ts`, `app/(app)/recipes/new/page.tsx`, `app/(app)/recipes/[id]/edit/page.tsx`, `app/(app)/spesa/[weekStart]/page.tsx`

**Interfaces:**

- Consumes: `db.catalogItem` and `CatalogItemKind` from Task 1; `CatalogItemInput` from Task 2.
- Produces:

```ts
export class CatalogItemExistsError extends Error {}
export class CatalogItemInUseError extends Error {}
export class CatalogItemNotFoundError extends Error {}
export class UnknownAisleError extends Error {}

export type IngredientOption = { name: string; defaultUnit: string | null }
export type CatalogOption = IngredientOption & { aisle: string }
export type CatalogRow = {
  name: string
  kind: CatalogItemKind
  defaultUnit: string | null
  aisle: string
  usedIn: number
}

export function rankUnitsByUse(
  rows: { unit: string | null; uses: number }[]
): string[]
export function isKnownAisle(aisle: string): boolean
export function kindFilterFor(
  tipo: string | undefined
): CatalogItemKind | undefined

export async function listIngredientOptions(): Promise<IngredientOption[]>
export async function listCatalogOptions(): Promise<CatalogOption[]>
export async function findIngredientByName(
  name: string
): Promise<IngredientOption | null>
export async function listUsedUnits(): Promise<string[]>
export async function createIngredient(name: string): Promise<IngredientOption>
export async function listCatalogItems(
  query?: string,
  kind?: CatalogItemKind
): Promise<CatalogRow[]>
export async function getCatalogItem(name: string): Promise<CatalogRow | null>
export async function createCatalogItem(input: CatalogItemInput): Promise<void>
export async function updateCatalogItem(
  name: string,
  input: CatalogItemInput
): Promise<void>
export async function deleteCatalogItem(name: string): Promise<void>
```

- [ ] **Step 1: Move the two files**

```bash
git mv lib/services/ingredients.ts lib/services/catalog.ts
git mv lib/services/ingredients.test.ts lib/services/catalog.test.ts
```

- [ ] **Step 2: Write the failing test for `kindFilterFor`**

The chips post their choice as a search param, which is a string from the address bar and therefore untrusted. Append to `lib/services/catalog.test.ts`, and change its import to `@/lib/services/catalog`:

```ts
describe("kindFilterFor", () => {
  it("maps the ingredients chip to a kind", () => {
    expect(kindFilterFor("ingredienti")).toBe("INGREDIENT")
  })

  it("maps the products chip to a kind", () => {
    expect(kindFilterFor("prodotti")).toBe("PRODUCT")
  })

  it("filters nothing when no chip is chosen", () => {
    expect(kindFilterFor(undefined)).toBeUndefined()
  })

  it("filters nothing for a value nobody offered, rather than listing zero rows", () => {
    expect(kindFilterFor("INGREDIENT")).toBeUndefined()
    expect(kindFilterFor("shampoo")).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/catalog.test.ts
```

Expected: FAIL — `kindFilterFor` is not exported.

- [ ] **Step 4: Rename the exports and add the kind**

In `lib/services/catalog.ts`, apply the rename table, keeping every TSDoc block and updating the prose inside it where it says "ingredient" about something that is now an entry:

| Was                        | Is now                     |
| -------------------------- | -------------------------- |
| `IngredientExistsError`    | `CatalogItemExistsError`   |
| `IngredientInUseError`     | `CatalogItemInUseError`    |
| `IngredientNotFoundError`  | `CatalogItemNotFoundError` |
| `IngredientRow`            | `CatalogRow`               |
| `CatalogueOption`          | `CatalogOption`            |
| `listIngredients`          | `listIngredientOptions`    |
| `listIngredientsWithAisle` | `listCatalogOptions`       |
| `listIngredientsWithUsage` | `listCatalogItems`         |
| `getIngredient`            | `getCatalogItem`           |
| `createFullIngredient`     | `createCatalogItem`        |
| `updateIngredient`         | `updateCatalogItem`        |
| `deleteIngredient`         | `deleteCatalogItem`        |

`IngredientOption`, `findIngredientByName`, `createIngredient`, `listUsedUnits`, `rankUnitsByUse`, `isKnownAisle` and `UnknownAisleError` keep their names: each is still about an ingredient specifically, or about neither.

Then four changes of substance.

`listIngredientOptions` gains the filter that is the whole point of `kind` — the recipe form must never offer shampoo:

```ts
export async function listIngredientOptions(): Promise<IngredientOption[]> {
  return db.catalogItem.findMany({
    where: { kind: "INGREDIENT" },
    select: { name: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })
}
```

`createIngredient` — the inline path from the recipe form — states its kind rather than leaning on the column default, because that default may one day change and this call site must not:

```ts
return await db.catalogItem.create({
  data: { name, kind: "INGREDIENT" },
  select: { name: true, defaultUnit: true },
})
```

`kindFilterFor`, new, with the chips' vocabulary in one place:

```ts
// The chips' own vocabulary, Italian because it is in the address bar the user
// sees. Anything else filters nothing: a search param is typed by hand as often
// as it is clicked, and a screen showing zero rows for a typo is worse than one
// showing everything.
const KIND_BY_CHIP: Record<string, CatalogItemKind> = {
  ingredienti: "INGREDIENT",
  prodotti: "PRODUCT",
}

/**
 * Maps the `?tipo=` search param to a kind to filter on.
 *
 * Exported for its own test: it is the only logic on the catalogue screen that
 * can be asserted without a database.
 *
 * @param tipo The raw search param, or undefined when no chip is chosen.
 * @returns The kind to filter by, or undefined to filter by nothing.
 */
export function kindFilterFor(
  tipo: string | undefined
): CatalogItemKind | undefined {
  return tipo === undefined ? undefined : KIND_BY_CHIP[tipo]
}
```

`listCatalogItems` and `getCatalogItem` both select `kind` and pass it through, and `listCatalogItems` takes the filter:

```ts
export async function listCatalogItems(
  query?: string,
  kind?: CatalogItemKind
): Promise<CatalogRow[]> {
  const trimmed = query?.trim()

  const rows = await db.catalogItem.findMany({
    where: {
      ...(trimmed ? { name: { contains: trimmed, mode: "insensitive" } } : {}),
      ...(kind === undefined ? {} : { kind }),
    },
    select: {
      name: true,
      kind: true,
      defaultUnit: true,
      aisle: true,
      _count: { select: { usedIn: true } },
    },
    orderBy: { name: "asc" },
  })

  return rows.map(({ _count, ...row }) => ({ ...row, usedIn: _count.usedIn }))
}
```

Import the kind type at the top: `import type { CatalogItemInput, CatalogItemKind } from "@/lib/schemas/catalog"`. The Zod-derived union and the Prisma enum are the same two strings, so Prisma accepts it without importing anything from `lib/generated`.

Update the TSDoc on `createCatalogItem` and `updateCatalogItem` so it mentions the kind, and on `createIngredient` so it says the entry is created as an ingredient.

- [ ] **Step 5: Run the tests and watch them pass**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm exec vitest run lib/services/catalog.test.ts
```

Expected: PASS, eleven cases.

- [ ] **Step 6: Follow the renames through every importer**

Seven files import from `@/lib/services/ingredients`. Change the path and the symbols per the table in Step 4. The mechanical ones:

- `app/(app)/recipes/new/page.tsx:4,13` and `app/(app)/recipes/[id]/edit/page.tsx:6,21` — `listIngredients` → `listIngredientOptions`
- `app/(app)/spesa/[weekStart]/page.tsx` — `listIngredientsWithAisle` → `listCatalogOptions`
- `app/(app)/recipes/actions.ts` — the path, plus `IngredientExistsError` → `CatalogItemExistsError`
- `app/(app)/ingredients/{page,new/page,[name]/edit/page}.tsx` and `actions.ts` — the path and the whole table

`components/shopping/add-item-form.tsx` exports its own local `CatalogueEntry` type. Leave it — plan B replaces that file.

- [ ] **Step 7: Run the gate**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Expected: green, 171 tests plus the eleven from Steps 2 and Task 2.

- [ ] **Step 8: Commit**

```bash
git add lib/services app/\(app\)
git commit -m "feat: the ingredient service becomes the catalogue service

listIngredientOptions now filters to kind INGREDIENT, which is the whole reason
the column exists: the picker inside the recipe form must never offer shampoo.
kindFilterFor maps the ?tipo= chip to a kind and deliberately filters nothing
for a value nobody offered — a search param is typed by hand as often as it is
clicked, and zero rows for a typo reads as an empty catalogue.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `/ingredients` becomes `/catalogo`

A move, plus the nav. The screen still shows what it showed; the chips arrive in Task 5.

**Files:**

- Create: `app/(app)/catalogo/**` (by `git mv` from `app/(app)/ingredients/**`)
- Create: `components/catalog/catalog-form.tsx` (by `git mv` from `components/ingredients/ingredient-form.tsx`)
- Modify: `components/app-nav.tsx:22-27`

**Interfaces:**

- Consumes: everything Task 3 produced.
- Produces: the routes `/catalogo`, `/catalogo/new`, `/catalogo/[name]/edit`, and `saveCatalogItem` / `removeCatalogItem` in `app/(app)/catalogo/actions.ts`.

- [ ] **Step 1: Move the files**

```bash
git mv "app/(app)/ingredients" "app/(app)/catalogo"
mkdir -p components/catalog
git mv components/ingredients/ingredient-form.tsx components/catalog/catalog-form.tsx
```

`components/ingredients/` keeps `ingredient-picker.tsx`, `ingredient-rows.tsx` and `unit-input.tsx`. Those are about the ingredients of a recipe and have not stopped being so.

- [ ] **Step 2: Rename the component and its types**

In `components/catalog/catalog-form.tsx`:

| Was                           | Is now                     |
| ----------------------------- | -------------------------- |
| `IngredientForm`              | `CatalogForm`              |
| `IngredientFormValues`        | `CatalogFormValues`        |
| `IngredientFormState`         | `CatalogFormState`         |
| `SaveIngredientAction`        | `SaveCatalogItemAction`    |
| `EMPTY_INGREDIENT_FORM_STATE` | `EMPTY_CATALOG_FORM_STATE` |

The two `href="/ingredients"` in the «Annulla» button become `/catalogo`.

- [ ] **Step 3: Rename the actions and their targets**

In `app/(app)/catalogo/actions.ts`: `saveIngredient` → `saveCatalogItem`, `removeIngredient` → `removeCatalogItem`, the import of the form state type follows Step 2, and every `revalidatePath("/ingredients")` and `redirect("/ingredients", …)` becomes `/catalogo`. Leave `revalidatePath("/recipes")` alone — a rename still moves the recipe lines with it.

- [ ] **Step 4: Update the three pages**

In `app/(app)/catalogo/page.tsx`, `new/page.tsx` and `[name]/edit/page.tsx`: the imports from `@/app/(app)/ingredients/actions` and `@/components/ingredients/ingredient-form` follow the moves, every `/ingredients` href and `back.href` becomes `/catalogo`, and the copy changes:

| Where                            | Was                              | Is now                      |
| -------------------------------- | -------------------------------- | --------------------------- |
| `page.tsx` metadata + title      | `Ingredienti`                    | `Catalogo`                  |
| `new/page.tsx` metadata + title  | `Nuovo ingrediente`              | `Nuova voce`                |
| `edit/page.tsx` metadata + title | `Modifica ingrediente`           | `Modifica voce`             |
| `new`/`edit` back label          | `Ingredienti`                    | `Catalogo`                  |
| `page.tsx` empty state           | `Aggiungi il primo ingrediente.` | `Aggiungi la prima voce.`   |
| `page.tsx` empty CTA             | `Nuovo ingrediente`              | `Nuova voce`                |
| `loading.tsx` label              | `Caricamento degli ingredienti…` | `Caricamento del catalogo…` |
| `edit/loading.tsx` label         | `Caricamento dell’ingrediente…`  | `Caricamento della voce…`   |

`announce()` in `page.tsx` becomes:

```ts
function announce(count: number) {
  if (count === 0) return "Nessuna voce trovata."
  return count === 1 ? "1 voce trovata." : `${count} voci trovate.`
}
```

Leave the «non usato / N ricette» line exactly as it is: it still counts recipes, and for a product the answer is always «non usato», which is true.

- [ ] **Step 5: Update the nav**

`components/app-nav.tsx`, in `NAV_ITEMS`:

```ts
  { href: "/catalogo", label: "Catalogo" },
```

replacing the `/ingredients` entry, in the same position.

- [ ] **Step 6: Run the gate and the app**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Expected: green. Then, in the browser at 390px — the owner already runs `pnpm dev` on port 3000, so reuse it rather than starting a second:

1. `/catalogo` lists the catalogue, header reads «Catalogo».
2. The nav's fourth entry reads «Catalogo» and carries `aria-current` when you are on it.
3. `/catalogo/new` saves a new entry and lands back on `/catalogo`.
4. Editing an entry's aisle saves and lands back on `/catalogo`.
5. `/ingredients` answers 404. That is intended — see Step 7.

- [ ] **Step 7: Commit**

No redirect is left behind at `/ingredients`. The app is private, nothing links to it from outside, and the nav is the only way anyone reaches the screen.

```bash
git add app components
git commit -m "feat: the catalogue screen moves to /catalogo

The screen is unchanged; its name stopped being true. No redirect is left at
/ingredients: the app is private, nothing outside links to it, and the nav is
the only route in.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: The kind, on the screen

**Files:**

- Create: `components/catalog/kind-filter.tsx`
- Modify: `app/(app)/catalogo/page.tsx`, `app/(app)/catalogo/new/page.tsx`, `app/(app)/catalogo/[name]/edit/page.tsx`, `app/(app)/catalogo/actions.ts`, `components/catalog/catalog-form.tsx`

**Interfaces:**

- Consumes: `kindFilterFor`, `listCatalogItems`, `CatalogRow`, `getCatalogItem` from Task 3; `CatalogItemInputSchema` from Task 2.
- Produces: `KindFilter` — a server component, so no `"use client"`.

- [ ] **Step 1: The chips**

`components/catalog/kind-filter.tsx`:

```tsx
import Link from "next/link"

import { cn } from "@/lib/utils"

const CHIPS = [
  { tipo: undefined, label: "Tutti" },
  { tipo: "ingredienti", label: "Ingredienti" },
  { tipo: "prodotti", label: "Prodotti" },
] as const

// Links and not buttons, and therefore no "use client": the choice belongs in
// the address bar, so it survives a refresh and can be shared between the two
// phones. A client component here would buy nothing and pull the boundary up.
export function KindFilter({
  active,
  query,
}: {
  // The raw `?tipo=`, so an unrecognised value highlights nothing rather than
  // silently highlighting "Tutti" while the list shows everything anyway.
  active: string | undefined
  query: string | undefined
}) {
  const hrefFor = (tipo: string | undefined) => {
    const params = new URLSearchParams()
    if (tipo !== undefined) params.set("tipo", tipo)
    if (query) params.set("q", query)
    const search = params.toString()
    return search === "" ? "/catalogo" : `/catalogo?${search}`
  }

  return (
    <nav aria-label="Filtra per tipo">
      <ul className="flex gap-2">
        {CHIPS.map((chip) => {
          const current = chip.tipo === active
          return (
            <li key={chip.label}>
              <Link
                href={hrefFor(chip.tipo)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-4xl border px-3 text-sm transition-colors",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                {chip.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Wire the filter into the list**

In `app/(app)/catalogo/page.tsx`, widen the search params and pass the kind through:

```tsx
export default async function CatalogPage({
  searchParams,
}: {
  // Next resolves a repeated param to a string array, not a string.
  searchParams: Promise<{ q?: string | string[]; tipo?: string | string[] }>
}) {
  const { q: rawQuery, tipo: rawTipo } = await searchParams
  const q = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery
  const tipo = Array.isArray(rawTipo) ? rawTipo[0] : rawTipo
  const isSearching = Boolean(q?.trim())
  const items = await listCatalogItems(q, kindFilterFor(tipo))
```

Render `<KindFilter active={tipo} query={q} />` between the `PageHeader` and the `DataList`, and add a `Badge` for the kind on each row, before the aisle badge:

```tsx
{
  item.kind === "PRODUCT" ? <Badge>prodotto</Badge> : null
}
;<Badge variant="secondary">{item.aisle}</Badge>
```

Only products are badged. Marking both would put a badge on every row of a list that is mostly ingredients, which is noise rather than information.

The empty state needs a third case, or filtering to a kind with no entries reads as an empty catalogue:

```tsx
        empty={
          isSearching ? (
            <EmptyState title="Nessuna voce con questo nome." />
          ) : tipo !== undefined ? (
            <EmptyState title="Nessuna voce di questo tipo." />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto."
              description="Aggiungi la prima voce."
            >
              …
            </EmptyState>
          )
        }
```

- [ ] **Step 3: The `Tipo` field on the form**

In `components/catalog/catalog-form.tsx`, add `kind` to `CatalogFormValues` (`kind: string`) and to `FIELD_ORDER`, after `name`. Add the field between «Nome» and «Unità preferita», modelled exactly on the existing aisle `Select`:

```tsx
<Field data-invalid={invalid("kind")}>
  <FieldLabel htmlFor="kind">Tipo</FieldLabel>
  <Select name="kind" defaultValue={valueOf("kind")}>
    <SelectTrigger
      id="kind"
      aria-invalid={errorOf("kind") ? true : undefined}
      aria-describedby={describedBy("kind", true)}
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="INGREDIENT">Ingrediente</SelectItem>
      <SelectItem value="PRODUCT">Prodotto</SelectItem>
    </SelectContent>
  </Select>
  <FieldDescription id="kind-description">
    Solo un ingrediente compare fra quelli scegliibili in una ricetta.
  </FieldDescription>
  <FieldError id="kind-error">{errorOf("kind")}</FieldError>
</Field>
```

The stored value is English because it is a database value that happens to be an enum member; the two labels are Italian because they are what the user reads.

- [ ] **Step 4: Carry it through the pages and the action**

`app/(app)/catalogo/new/page.tsx` — `values={{ name: "", kind: "INGREDIENT", defaultUnit: "", aisle: AISLE_UNKNOWN }}`.

`app/(app)/catalogo/[name]/edit/page.tsx` — `kind: item.kind` in `values`.

`app/(app)/catalogo/actions.ts` — add `kind` to `FORM_FIELDS` and to the parse:

```ts
const parsed = CatalogItemInputSchema.safeParse({
  name: formData.get("name"),
  kind: formData.get("kind") ?? undefined,
  defaultUnit: formData.get("defaultUnit") ?? "",
  aisle: formData.get("aisle") ?? "",
})
```

`?? undefined` and not `?? ""`: the schema defaults a missing kind to `INGREDIENT`, and an empty string would instead fail the enum with a message no user could act on.

- [ ] **Step 5: Run the gate**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Expected: green.

- [ ] **Step 6: Run the design skill over the changed files**

`CLAUDE.md` binds this: UI work is not done until `web-design-guidelines` has been run over the changed files and its findings addressed or explicitly dismissed. Run it over `components/catalog/kind-filter.tsx`, `components/catalog/catalog-form.tsx` and `app/(app)/catalogo/page.tsx`. Fix what it finds, or write down why not.

- [ ] **Step 7: Commit**

```bash
git add app components
git commit -m "feat: the catalogue screen filters by kind and sets it

Three chips as links, not buttons: the choice belongs in the address bar so it
survives a refresh, and a client component would have pulled the boundary up
for nothing. Only products carry a badge — marking both kinds would put one on
every row of a list that is mostly ingredients.

An unrecognised ?tipo= filters nothing rather than listing zero rows. A search
param is typed by hand as often as it is clicked.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The browser checklist, and the roadmap

**Files:**

- Modify: `docs/roadmap.md`

- [ ] **Step 1: Walk the checklist at 390px**

Reuse the owner's running `pnpm dev` on port 3000. Every point is pass or fail; a fail is fixed before the plan closes.

1. `/catalogo` lists every entry, ordered by name, with the aisle badge on each.
2. «Tutti» is highlighted and carries `aria-current="page"`; the other two do not.
3. «Prodotti» shows an empty state reading «Nessuna voce di questo tipo.» — the catalogue has no products yet.
4. Search for `pom`, then tap «Ingredienti»: the query survives the chip, the address bar reads `?tipo=ingredienti&q=pom`.
5. `/catalogo?tipo=banane` lists everything and highlights no chip.
6. `/catalogo/new`, name `Shampoo`, tipo `Prodotto`, reparto `casa e pulizia`, save. The list shows **shampoo**, lowercase, with a `prodotto` badge.
7. Tap «Prodotti»: shampoo, and only shampoo.
8. `/recipes/new` → the ingredient picker: type `sham`. **No result, and «Crea «sham»» offered.** This is the point of the whole task.
9. Edit shampoo, change tipo to `Ingrediente`, save. It now appears in the recipe picker. Change it back to `Prodotto`.
10. `/catalogo/new`, name `  Pomodori  `, save: refused with «Esiste già un ingrediente con questo nome.» — because it lowercased to `pomodori`, which exists.
11. Delete shampoo from its edit screen. It goes; the list is back to 108.
12. The nav's fourth entry reads «Catalogo».

- [ ] **Step 2: Update the roadmap**

In `docs/roadmap.md`, add a row to the Shipped table:

```markdown
| [`2026-08-18-catalogue`](superpowers/plans/2026-08-18-catalogue.md) | `Ingredient` renamed `CatalogItem` with a `kind`, `/catalogo` with its three chips, and names lowercased in `lib/schemas/catalog.ts` |
```

Update `Last updated:` to 2026-08-18. Under "Not started", add a line naming plans B and C as the next two, in that order.

Two notes belong there and nowhere else, because they will otherwise be rediscovered the hard way:

- The `Ingredient` → `CatalogItem` migration is hand-written. Regenerating it from the schema produces a DROP and a CREATE.
- The seed's 108 entries are all `INGREDIENT`. `prisma/catalog.ts` sets no kind and relies on the column default; adding a product to the seed means adding the field.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: record the catalogue plan as shipped

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch`. One PR, squash-merged — the roadmap's standing decision — and the branch deleted afterwards. Plan B is cut from `main`, not from this branch.
