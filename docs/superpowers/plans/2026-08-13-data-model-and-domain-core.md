# Data Model and Domain Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the persistent schema and the pure domain functions the whole module is built on — week arithmetic, ingredient normalisation, ingredient parsing, aisle ordering and the shopping-list aggregator — with no UI, no authentication and no LLM.

**Architecture:** Everything in this plan is either a Prisma model or a pure function. The aggregator, the highest-value component in the project, takes plain data and returns plain data, so it is unit-tested without a database. The service that loads and persists around it arrives in a later plan. Leaf modules under `lib/` hold constants and date arithmetic and import nothing, so both services and components may use them.

**Tech Stack:** Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), Postgres on Neon, TypeScript, Vitest, tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-08-13-menu-spesa-design.md`

## Global Constraints

Copied from `CLAUDE.md` and `docs/conventions/`. Every task's requirements implicitly include these.

- `lib/services/**` must not import from `app/`, `components/`, `hooks/`, React or `next/*`, and must not reference `Request` or `Response`. ESLint enforces it.
- Every **exported** function in `lib/services/` carries a TSDoc block: one-line summary, `@param`, `@returns`, `@throws` if it throws. No types in the annotations. ESLint enforces it. Private helpers are exempt.
- No default exports in `lib/services/`. No `index.ts` barrel files anywhere.
- `lib/schemas/**` imports nothing but `zod`, and may never declare a property named `actorId`.
- Prisma is reached only through `db` imported from `@/lib/db`. Never construct a `PrismaClient` elsewhere. The client is generated into `lib/generated/prisma` and imported from there, **not** from `@prisma/client`.
- `process.env` is read only in `lib/env.ts`. ESLint enforces it.
- Identifiers, comments, TSDoc, file names, commit messages and test names are **English**. Database _values_ stay Italian because they are data (`"ortofrutta"`, `"320 g di spaghetti"`).
- File and directory names are `kebab-case`. Functions and variables `camelCase`. Types `PascalCase` with no `I` prefix. Constants `SCREAMING_SNAKE_CASE`. Prisma models `PascalCase` singular.
- Comment only to explain _why_. No section dividers, no commented-out code.
- Anything tunable is a named constant or an environment variable, never a number typed inline.
- `pnpm verify` (typecheck + lint + tests) is the gate. "It should work" is not a report; the command output is.
- Never commit to `main`. All work in this plan happens on a branch.
- Test behaviour through the public function. Table-driven (`it.each`) for parsers. Never test Prisma itself.

## Prerequisites

Not created by this plan; confirm before Task 2.

- A Neon project exists, and `.env` holds a real `DATABASE_URL` (pooled) and `DIRECT_URL` (direct). Getting these two backwards produces migrations that hang. See `docs/conventions/data.md`.
- `pnpm install` has run, so `postinstall` has generated the Prisma client.
- A working branch exists: `git switch -c feat/data-model-and-domain-core`.

## File Structure

| File                                          | Responsibility                                   |
| --------------------------------------------- | ------------------------------------------------ |
| `prisma/schema.prisma`                        | the whole persistent model (modified)            |
| `prisma/migrations/*_init_menu_and_shopping/` | the initial migration (generated)                |
| `prisma/seed.ts`                              | idempotent seed of the two fixed users           |
| `lib/config.ts`                               | tunable domain constants, imported from anywhere |
| `lib/week.ts`                                 | week and day arithmetic in the app's timezone    |
| `lib/aisles.ts`                               | the supermarket aisle order                      |
| `lib/services/ingredient-name.ts`             | the normalised-name contract                     |
| `lib/services/ingredient-parse.ts`            | Italian ingredient line → quantity, unit, name   |
| `lib/services/shopping-aggregate.ts`          | the pure shopping-list aggregator                |

Tests sit next to the code they cover, named `*.test.ts`.

---

### Task 1: Correct the convention documents

The documents are read as binding by every later task, and three of them are currently wrong or too narrow to permit what this plan builds. Fixing them first keeps every later commit from arguing with them. Docs only, no code.

**Files:**

- Modify: `docs/conventions/data.md` — the week boundary paragraph
- Modify: `docs/conventions/architecture.md` — the dependency-direction table
- Modify: `CLAUDE.md` — the `base-vs-radix` path
- Modify: `docs/conventions/ui.md` — the `base-vs-radix` path

- [ ] **Step 1: Fix the two wrong pointers to the shadcn reference**

Both documents point at a file that does not exist. The real path is `.agents/skills/shadcn/rules/base-vs-radix.md`.

In `CLAUDE.md`, in the "Vendor documentation on disk" list, replace:

```
- `.agents/skills/shadcn/` — including `references/base-vs-radix.md`; this project
```

with:

```
- `.agents/skills/shadcn/` — including `rules/base-vs-radix.md`; this project
```

In `docs/conventions/ui.md`, replace:

```
online is written against Radix, so prop names and composition patterns do not
always transfer. Read `.agents/skills/shadcn/references/base-vs-radix.md` rather
```

with:

```
online is written against Radix, so prop names and composition patterns do not
always transfer. Read `.agents/skills/shadcn/rules/base-vs-radix.md` rather
```

- [ ] **Step 2: Make the week boundary unambiguous in `docs/conventions/data.md`**

The current wording says `Menu.weekStart` is "Monday at 00:00 local time". Stored as a timestamp, "local" depends on the server's timezone, which on Vercel is UTC and on the development machine is not. The same Monday would then be two different instants, and `@unique` would let both exist.

Replace this bullet list under "## Dates and time":

```
- Store `DateTime` in UTC; Prisma and Postgres handle that. Format for display at
  the edge, in the component.
- The week starts on **Monday**. `Menu.weekStart` is Monday at 00:00 local time.
  Do not scatter alternative week-boundary logic through the codebase — one
  helper, used everywhere.
- `MenuSlot.day` is `0 = Monday … 6 = Sunday`, which is not JavaScript's
  `getDay()`. Convert in one place.
```

with:

```
- Store `DateTime` in UTC; Prisma and Postgres handle that. Format for display at
  the edge, in the component.
- The week starts on **Monday**. `Menu.weekStart` is a Postgres `date`
  (`DateTime @db.Date`), not a timestamp: it identifies a week, it does not mark
  an instant. Stored as a timestamp it would mean a different moment depending on
  the server's timezone, and `@unique` would then admit two rows for one week.
- **Which** week a moment falls in does depend on a timezone, and that one is
  `APP_TIMEZONE` in `lib/config.ts`, never the server's. Vercel runs in UTC; at
  01:00 on a Roman Monday it is still Sunday there.
- `MenuSlot.day` is `0 = Monday … 6 = Sunday`, which is not JavaScript's
  `getDay()`. Convert in one place.
- All of the above lives in `lib/week.ts` and nowhere else.
```

- [ ] **Step 3: Widen the dependency table for leaf modules in `docs/conventions/architecture.md`**

The table currently allows `components/**` to import only `lib/schemas` and `lib/utils`, and `lib/services/**` only `lib/schemas` and `lib/db`. This plan adds three modules that both layers legitimately need — the aisle order groups the shopping list on screen and sorts it in the aggregator; the week helper formats dates on screen and computes them in services.

Replace the two affected rows of the table:

```
| `components/**`   | `components/**`, `hooks/**`, `lib/schemas`, `lib/utils`             | `lib/services/**`, `lib/db`, `lib/env`                    |
| `lib/services/**` | `lib/services/**`, `lib/schemas/**`, `lib/db`, node built-ins, SDKs | `app/**`, `components/**`, `hooks/**`, `react`, `next/**` |
```

with:

```
| `components/**`   | `components/**`, `hooks/**`, `lib/schemas`, leaf modules            | `lib/services/**`, `lib/db`, `lib/env`                    |
| `lib/services/**` | `lib/services/**`, `lib/schemas/**`, `lib/db`, leaf modules, node built-ins, SDKs | `app/**`, `components/**`, `hooks/**`, `react`, `next/**` |
```

Then add this paragraph directly below the table, before the sentence beginning "`lib/schemas/` importing nothing but Zod":

```
A **leaf module** is a file directly under `lib/` that imports nothing but `zod`
and other leaf modules: `utils.ts`, `config.ts`, `week.ts`, `aisles.ts`. They
carry constants and pure arithmetic, they reach neither the database nor the
network, and both layers may import them. Anything that grows a dependency
outside that set stops being a leaf and moves into `lib/services/`.
```

- [ ] **Step 4: Verify nothing else in the repository points at the old paths**

Run: `git grep -n "references/base-vs-radix"`
Expected: no output.

Run: `git grep -n "00:00 local"`
Expected: matches only in `docs/superpowers/specs/2026-08-13-menu-spesa-design.md`, which is a dated design record and is not edited by this plan.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/conventions/architecture.md docs/conventions/data.md docs/conventions/ui.md
git commit -m "docs: settle the week boundary, admit leaf modules, fix two skill paths"
```

---

### Task 2: The Prisma schema and the initial migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_init_menu_and_shopping/migration.sql` (generated by the CLI, committed)

**Interfaces:**

- Consumes: nothing.
- Produces: the generated client at `lib/generated/prisma`, exposing `db.user`, `db.recipe`, `db.recipeIngredient`, `db.ingredientAisle`, `db.menu`, `db.menuSlot`, `db.shoppingList`, `db.shoppingListItem`, and the `MealType` enum with members `LUNCH` and `DINNER`.

Prisma itself is not tested (`docs/conventions/testing.md`), so this task's verification is the migration applying and the client typechecking.

- [ ] **Step 1: Write the models**

Replace the whole of `prisma/schema.prisma` with:

```prisma
// Prisma schema. Connection URLs live in ../prisma.config.ts (Prisma 7).
// The data model is defined by docs/superpowers/specs/2026-08-13-menu-spesa-design.md.

generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Identity only. Credential storage belongs to whatever authentication lands,
// and arrives in its own migration. See design document section 6.4.
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())

  checkedItems ShoppingListItem[]
}

model Recipe {
  id           String             @id @default(cuid())
  title        String
  sourceUrl    String?
  servings     Int?
  totalMinutes Int?
  instructions String?
  notes        String?
  tags         String[]
  ingredients  RecipeIngredient[]
  slots        MenuSlot[]
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
}

model RecipeIngredient {
  id       String  @id @default(cuid())
  recipeId String
  recipe   Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  raw      String
  name     String
  quantity Float?
  unit     String?
  position Int

  // The aggregation loads every ingredient of every selected recipe at once.
  @@index([recipeId])
}

// Learned mapping from a normalised ingredient name to a supermarket aisle.
// The key is the output of normaliseIngredientName; changing that function
// orphans every row here and needs a migration that remaps them.
model IngredientAisle {
  name  String @id
  aisle String
}

model Menu {
  id        String        @id @default(cuid())
  weekStart DateTime      @unique @db.Date
  slots     MenuSlot[]
  list      ShoppingList?
  createdAt DateTime      @default(now())
}

model MenuSlot {
  id       String   @id @default(cuid())
  menuId   String
  menu     Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  day      Int
  meal     MealType
  recipeId String?
  recipe   Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  freeText String?
  servings Int?

  @@unique([menuId, day, meal])
}

enum MealType {
  LUNCH
  DINNER
}

model ShoppingList {
  id        String             @id @default(cuid())
  menuId    String             @unique
  menu      Menu               @relation(fields: [menuId], references: [id], onDelete: Cascade)
  items     ShoppingListItem[]
  createdAt DateTime           @default(now())
}

model ShoppingListItem {
  id          String       @id @default(cuid())
  listId      String
  list        ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  name        String
  quantity    Float?
  unit        String?
  aisle       String
  checked     Boolean      @default(false)
  checkedById String?
  checkedBy   User?        @relation(fields: [checkedById], references: [id], onDelete: SetNull)
  checkedAt   DateTime?
  manual      Boolean      @default(false)

  @@index([listId])
}
```

Three choices worth knowing, because they read as omissions:

`weekStart` is `@db.Date`, per the convention corrected in Task 1. `MenuSlot.position` has no unique constraint on `[recipeId, position]` for ingredients either — reordering rows would transiently violate it, and Postgres does not defer it by default. `MenuSlot.day` is a plain `Int` rather than an enum because it is arithmetic, not a category.

- [ ] **Step 2: Check the schema parses before touching the database**

Run: `pnpm exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Create and apply the migration**

Run: `pnpm db:migrate --name init_menu_and_shopping`

Expected: the CLI creates `prisma/migrations/<timestamp>_init_menu_and_shopping/migration.sql`, applies it, and regenerates the client.

If it hangs instead of finishing, `DIRECT_URL` is pointing at the pooled endpoint. Migrations cannot run through a pooler.

- [ ] **Step 4: Confirm the migration is applied and says what it should**

Run: `pnpm exec prisma migrate status`
Expected: `Database schema is up to date!`

Run: `git grep -c "CREATE TABLE" -- prisma/migrations`
Expected: `8` — `User`, `Recipe`, `RecipeIngredient`, `IngredientAisle`, `Menu`, `MenuSlot`, `ShoppingList`, `ShoppingListItem`.

Run: `git grep -n "weekStart" -- prisma/migrations`
Expected: a line declaring `"weekStart" DATE NOT NULL`. If it says `TIMESTAMP`, the `@db.Date` attribute was dropped — go back to Step 1.

Run: `pnpm typecheck`
Expected: PASS. This exercises the regenerated client against the existing code.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add the menu and shopping data model"
```

---

### Task 3: Make services runnable outside Next, and seed the two users

The recipe bootstrap of design document section 10.4 is a script, not an HTTP handler, and `docs/conventions/architecture.md` promises services stay callable from outside a request. That promise does not currently hold: `lib/db.ts` opens with `import "server-only"`, whose default entry point **throws on import**. A plain `tsx prisma/seed.ts` crashes before reaching any query.

The fix is the `react-server` export condition, which resolves `server-only` to an empty module. Vitest already solves the same problem a different way, with the stub at `test/stubs/server-only.ts`.

**Files:**

- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts`
- Modify: `package.json` — a `db:seed` script and the `tsx` devDependency
- Modify: `docs/conventions/data.md` — a note on running scripts

**Interfaces:**

- Consumes: `db` from `@/lib/db`, and the `User` model from Task 2.
- Produces: `pnpm db:seed`, an idempotent command creating the two fixed users. Later plans extend `prisma/seed.ts` with recipes.

- [ ] **Step 1: Add tsx**

Run: `pnpm add -D tsx`

- [ ] **Step 2: Write the seed script**

Create `prisma/seed.ts`:

```ts
import "dotenv/config"

import { db } from "../lib/db"

// The two fixed users of design document section 6.4. Change these to the real
// addresses before the first run; the app has no registration flow.
const USERS = [
  { email: "owner@example.invalid", name: "Thomas" },
  { email: "partner@example.invalid", name: "Partner" },
]

async function main() {
  for (const user of USERS) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: user,
    })
  }

  console.log(`Seeded ${USERS.length} users.`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
```

`import "dotenv/config"` is first so `lib/env.ts`, which validates at import time, finds the variables. The relative import of `../lib/db` sidesteps any question of whether the `@/` alias resolves under tsx; `lib/db.ts`'s own aliased imports still need it, and tsx reads `tsconfig.json` `paths` for them.

- [ ] **Step 3: Register the seed command**

In `prisma.config.ts`, extend the `migrations` block:

```ts
  migrations: {
    path: "prisma/migrations",
    // --conditions=react-server resolves the `server-only` guard in lib/db.ts to
    // an empty module, so the domain layer is reachable from a plain script.
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
```

In `package.json`, add to `scripts`, after `db:studio`:

```json
    "db:seed": "prisma db seed",
```

- [ ] **Step 4: Run it and confirm it works, twice**

Run: `pnpm db:seed`
Expected: `Seeded 2 users.` and exit code 0.

If it instead fails with `This module cannot be imported from a Client Component module`, the `--conditions` flag is not reaching Node — check that it precedes `--import tsx` in the command.

Run: `pnpm db:seed`
Expected: `Seeded 2 users.` again, still exit code 0. The `upsert` makes it re-runnable; a second run that fails means someone used `create`.

Run: `pnpm db:studio` and confirm the `User` table holds exactly two rows.

- [ ] **Step 5: Record the trap where the next person will look**

In `docs/conventions/data.md`, add a subsection at the end of the `## Prisma` section, directly before `### Migrations`:

```
### Running services from a script

`lib/db.ts` imports `server-only`, whose default entry point throws. A script
that imports the domain layer must therefore run with the `react-server`
condition, which resolves that guard to an empty module:

    node --conditions=react-server --import tsx <script>.ts

`prisma db seed` is configured this way in `prisma.config.ts`. Vitest solves the
same problem differently, aliasing `server-only` to `test/stubs/server-only.ts`.
Neither weakens the guard: it still fires in a browser bundle, which is its job.
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml prisma.config.ts prisma/seed.ts docs/conventions/data.md
git commit -m "feat: seed the two fixed users and make the domain layer script-runnable"
```

---

### Task 4: Tunable constants and week arithmetic

**Files:**

- Create: `lib/config.ts`
- Create: `lib/week.ts`
- Create: `lib/week.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `lib/config.ts`: `APP_TIMEZONE: string`, `HOUSEHOLD_SERVINGS: number`, `DEFAULT_COOLDOWN_DAYS: number`, `DAYS_IN_WEEK: number`
  - `lib/week.ts`: `weekStartFor(instant: Date): Date`, `dayIndexFor(instant: Date): number`, `dateForDay(weekStart: Date, day: number): Date`

Both are leaf modules, so they carry no TSDoc obligation — ESLint requires it only inside `lib/services/`. Comment them where the reasoning is non-obvious and nowhere else.

- [ ] **Step 1: Write the failing test**

Create `lib/week.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { dateForDay, dayIndexFor, weekStartFor } from "@/lib/week"

const iso = (date: Date) => date.toISOString().slice(0, 10)

describe("weekStartFor", () => {
  it("returns the Monday of the week a Thursday falls in", () => {
    expect(iso(weekStartFor(new Date("2026-08-13T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("returns the same day for a Monday", () => {
    expect(iso(weekStartFor(new Date("2026-08-10T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("keeps Sunday in the week that began six days earlier", () => {
    expect(iso(weekStartFor(new Date("2026-08-16T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("uses the app timezone, not UTC, to decide which week a moment is in", () => {
    // 23:30 UTC on Sunday is already 01:30 on Monday in Rome, so this instant
    // belongs to the week starting 2026-08-10, not the one before it.
    expect(iso(weekStartFor(new Date("2026-08-09T23:30:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("returns midnight UTC, so the value is a date and not an instant", () => {
    expect(weekStartFor(new Date("2026-08-13T12:00:00Z")).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z"
    )
  })
})

describe("dayIndexFor", () => {
  it("numbers Monday zero", () => {
    expect(dayIndexFor(new Date("2026-08-10T12:00:00Z"))).toBe(0)
  })

  it("numbers Sunday six", () => {
    expect(dayIndexFor(new Date("2026-08-16T12:00:00Z"))).toBe(6)
  })
})

describe("dateForDay", () => {
  it("maps day six of a week onto its Sunday", () => {
    expect(iso(dateForDay(new Date("2026-08-10T00:00:00Z"), 6))).toBe(
      "2026-08-16"
    )
  })

  it("does not mutate the week start it is given", () => {
    const weekStart = new Date("2026-08-10T00:00:00Z")
    dateForDay(weekStart, 3)
    expect(iso(weekStart)).toBe("2026-08-10")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/week.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/week"`.

- [ ] **Step 3: Write the constants**

Create `lib/config.ts`:

```ts
// Tunable domain constants. A number that means something belongs here, not
// inline at the point of use — see docs/conventions/architecture.md.

// Which week a moment falls in depends on where the users are, never on where
// the server is. Vercel runs in UTC.
export const APP_TIMEZONE = "Europe/Rome"

export const DAYS_IN_WEEK = 7

// The two people the app is for. A recipe's own servings is the source's yield;
// this is what the shopping list scales to.
export const HOUSEHOLD_SERVINGS = 2

// Recipes cooked within this many days are excluded from the candidates handed
// to the menu proposal, so the constraint cannot be argued with by a prompt.
export const DEFAULT_COOLDOWN_DAYS = 3
```

- [ ] **Step 4: Write the week helper**

Create `lib/week.ts`:

```ts
import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"

const zonedParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

// The calendar date the instant falls on in the app's timezone, expressed as
// midnight UTC. Reading the parts rather than formatting a string keeps this
// independent of how any locale happens to order them.
function civilDate(instant: Date): Date {
  const parts = new Map(
    zonedParts.formatToParts(instant).map((part) => [part.type, part.value])
  )

  return new Date(
    Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day"))
    )
  )
}

// getUTCDay() numbers Sunday zero; our weeks start on Monday.
const mondayFirst = (utcDay: number) =>
  (utcDay + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK

export function weekStartFor(instant: Date): Date {
  const date = civilDate(instant)
  date.setUTCDate(date.getUTCDate() - mondayFirst(date.getUTCDay()))
  return date
}

export function dayIndexFor(instant: Date): number {
  return mondayFirst(civilDate(instant).getUTCDay())
}

export function dateForDay(weekStart: Date, day: number): Date {
  const date = new Date(weekStart)
  date.setUTCDate(date.getUTCDate() + day)
  return date
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/week.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/config.ts lib/week.ts lib/week.test.ts
git commit -m "feat: add domain constants and week arithmetic"
```

---

### Task 5: The ingredient name normaliser

The output of this function is a primary key — `IngredientAisle.name` — and the aggregation key for the shopping list. Design document section 5 records why that makes it a contract rather than a helper.

**Files:**

- Create: `lib/services/ingredient-name.ts`
- Create: `lib/services/ingredient-name.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `normaliseIngredientName(raw: string): string`

- [ ] **Step 1: Write the failing test**

Create `lib/services/ingredient-name.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { normaliseIngredientName } from "@/lib/services/ingredient-name"

describe("normaliseIngredientName", () => {
  it.each([
    ["  Spaghetti  ", "spaghetti"],
    ["Pomodori Pelati", "pomodori pelati"],
    ["Olio   extravergine  d'oliva", "olio extravergine d'oliva"],
    ["di pomodoro", "pomodoro"],
    ["d'aglio", "aglio"],
    ["le patate", "patate"],
    ["della panna", "panna"],
  ])("normalises %j to %j", (raw, expected) => {
    expect(normaliseIngredientName(raw)).toBe(expected)
  })

  it.each([
    ["lardo", "lardo"],
    ["lenticchie", "lenticchie"],
    ["limone", "limone"],
    ["dattero", "dattero"],
    ["ilex", "ilex"],
  ])(
    "leaves %j alone, because a particle needs a word after it",
    (raw, expected) => {
      expect(normaliseIngredientName(raw)).toBe(expected)
    }
  )

  it("keeps distinct wordings distinct, because there is no synonym table", () => {
    expect(normaliseIngredientName("Pomodori pelati")).not.toBe(
      normaliseIngredientName("pelati")
    )
  })

  it("is idempotent, because its output is stored and re-read as a key", () => {
    const once = normaliseIngredientName("  Della  Panna  ")
    expect(normaliseIngredientName(once)).toBe(once)
  })
})
```

The five regression cases in the second block exist for one reason: a naïve `^(di|la|le|...)` alternation without a following-space requirement turns `lardo` into `rdo`. That bug is silent, corrupts a primary key, and is exactly the sort of thing that reaches the supermarket.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/ingredient-name.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/services/ingredient-name"`.

- [ ] **Step 3: Write the implementation**

Create `lib/services/ingredient-name.ts`:

```ts
// Word-final particles must be followed by whitespace, or "lardo" normalises to
// "rdo". The elided forms carry their own boundary in the apostrophe.
const LEADING_PARTICLE =
  /^(?:(?:di|del|dello|della|dei|degli|delle|il|lo|la|i|gli|le)\s+|[dl]')/

/**
 * Reduces an ingredient name to the form used as a key.
 *
 * Deliberately shallow: no stemming, no singularisation, no synonyms, so
 * "pomodori pelati" and "pelati" stay two lines until that becomes a nuisance.
 * The result is stored as `IngredientAisle.name` and as `RecipeIngredient.name`,
 * so changing this function orphans learned aisles and needs a migration that
 * remaps them.
 *
 * @param raw The name as written, from a recipe source or typed by hand.
 * @returns The normalised name, which is stable under a second application.
 */
export function normaliseIngredientName(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_PARTICLE, "")
    .trim()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/ingredient-name.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Confirm the TSDoc rule is satisfied**

Run: `pnpm lint`
Expected: no errors. A missing `@param` or `@returns` on the exported function fails here, by design.

- [ ] **Step 6: Commit**

```bash
git add lib/services/ingredient-name.ts lib/services/ingredient-name.test.ts
git commit -m "feat: add the ingredient name normaliser"
```

---

### Task 6: The Italian ingredient line parser

**Files:**

- Create: `lib/services/ingredient-parse.ts`
- Create: `lib/services/ingredient-parse.test.ts`

**Interfaces:**

- Consumes: `normaliseIngredientName` from `@/lib/services/ingredient-name`.
- Produces:
  - `type ParsedIngredient = { raw: string; quantity: number | null; unit: string | null; name: string }`
  - `parseIngredientLine(raw: string): ParsedIngredient`

Units are canonicalised on the way out — `gr` and `grammi` both become `g` — because the aggregator groups by `(name, unit)` and two spellings of one unit would produce two lines.

- [ ] **Step 1: Write the failing test**

Create `lib/services/ingredient-parse.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { parseIngredientLine } from "@/lib/services/ingredient-parse"

describe("parseIngredientLine", () => {
  it.each([
    ["320 g di spaghetti", 320, "g", "spaghetti"],
    ["1,5 kg di patate", 1.5, "kg", "patate"],
    ["1.5 kg di patate", 1.5, "kg", "patate"],
    ["200 ml di panna", 200, "ml", "panna"],
    ["500 gr di pomodori pelati", 500, "g", "pomodori pelati"],
    [
      "2 cucchiai di parmigiano grattugiato",
      2,
      "cucchiaio",
      "parmigiano grattugiato",
    ],
    ["1 spicchio d'aglio", 1, "spicchio", "aglio"],
    ["un cucchiaio di zucchero", 1, "cucchiaio", "zucchero"],
  ])("parses %j", (raw, quantity, unit, name) => {
    expect(parseIngredientLine(raw)).toEqual({ raw, quantity, unit, name })
  })

  it.each([
    ["2 uova", 2, "uova"],
    ["1/2 cipolla", 0.5, "cipolla"],
    ["una cipolla", 1, "cipolla"],
    ["un'acciuga", 1, "acciuga"],
  ])("reads %j as a bare count with no unit", (raw, quantity, name) => {
    expect(parseIngredientLine(raw)).toEqual({
      raw,
      quantity,
      unit: null,
      name,
    })
  })

  it.each([
    ["sale q.b.", "sale"],
    ["olio extravergine d'oliva q.b.", "olio extravergine d'oliva"],
    ["pepe qb", "pepe"],
    ["prezzemolo", "prezzemolo"],
    ["basilico quanto basta", "basilico"],
  ])("reads %j as unquantified", (raw, name) => {
    expect(parseIngredientLine(raw)).toEqual({
      raw,
      quantity: null,
      unit: null,
      name,
    })
  })

  it("preserves the original line even when it understands nothing", () => {
    const raw = "q.b. 1 1/2 misteri assortiti"
    expect(parseIngredientLine(raw).raw).toBe(raw)
  })

  it("does not mistake the start of a word for the article one", () => {
    expect(parseIngredientLine("unghie di gallina").quantity).toBeNull()
  })
})
```

Fixtures are real Italian ingredient strings, per `docs/conventions/testing.md`. When the parser gets a line wrong in real use, add that line to the table **before** fixing it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/ingredient-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/services/ingredient-parse"`.

- [ ] **Step 3: Write the implementation**

Create `lib/services/ingredient-parse.ts`:

```ts
import { normaliseIngredientName } from "@/lib/services/ingredient-name"

export type ParsedIngredient = {
  raw: string
  quantity: number | null
  unit: string | null
  name: string
}

// Every spelling maps to one canonical form, because the shopping list groups
// by (name, unit) and "gr" beside "g" would split one line into two.
const UNIT_ALIASES = new Map([
  ["g", "g"],
  ["gr", "g"],
  ["grammo", "g"],
  ["grammi", "g"],
  ["kg", "kg"],
  ["chilo", "kg"],
  ["chili", "kg"],
  ["chilogrammi", "kg"],
  ["ml", "ml"],
  ["cl", "cl"],
  ["l", "l"],
  ["lt", "l"],
  ["litro", "l"],
  ["litri", "l"],
  ["pz", "pz"],
  ["pezzo", "pz"],
  ["pezzi", "pz"],
  ["spicchio", "spicchio"],
  ["spicchi", "spicchio"],
  ["fetta", "fetta"],
  ["fette", "fetta"],
  ["foglia", "foglia"],
  ["foglie", "foglia"],
  ["cucchiaio", "cucchiaio"],
  ["cucchiai", "cucchiaio"],
  ["cucchiaino", "cucchiaino"],
  ["cucchiaini", "cucchiaino"],
  ["rametto", "rametto"],
  ["rametti", "rametto"],
  ["barattolo", "barattolo"],
  ["barattoli", "barattolo"],
  ["lattina", "lattina"],
  ["lattine", "lattina"],
  ["confezione", "confezione"],
  ["confezioni", "confezione"],
  ["bustina", "bustina"],
  ["bustine", "bustina"],
  ["pizzico", "pizzico"],
  ["pizzichi", "pizzico"],
  ["mazzetto", "mazzetto"],
  ["mazzetti", "mazzetto"],
])

// The final dot sits outside the word boundary, or "q.b." fails to match: after a
// full stop there is no word character for \b to anchor against.
const TO_TASTE = /\s*\b(?:q\.?\s?b|quanto basta)\b\.?\s*/
const LEADING_NUMBER = /^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*/
// "un" and friends need a boundary, or "unghie" starts with a quantity of one.
const LEADING_ONE = /^(?:(?:un|uno|una)\s+|un')/

function readQuantity(text: string): { quantity: number | null; rest: string } {
  const numeric = LEADING_NUMBER.exec(text)

  if (numeric !== null) {
    const [fullMatch, literal] = numeric
    const fraction = literal.split("/")
    const quantity =
      fraction.length === 2
        ? Number(fraction[0]) / Number(fraction[1])
        : Number(literal.replace(",", "."))

    return { quantity, rest: text.slice(fullMatch.length) }
  }

  const article = LEADING_ONE.exec(text)

  return article === null
    ? { quantity: null, rest: text }
    : { quantity: 1, rest: text.slice(article[0].length) }
}

function readUnit(text: string): { unit: string | null; rest: string } {
  const [token] = text.split(/\s+/, 1)
  const canonical = UNIT_ALIASES.get(token)

  return canonical === undefined
    ? { unit: null, rest: text }
    : { unit: canonical, rest: text.slice(token.length) }
}

/**
 * Splits an Italian ingredient line into a quantity, a unit and a name.
 *
 * Never throws and never loses anything: an unrecognisable line comes back with
 * a null quantity and unit, and `raw` always holds what was written. The shopping
 * list shows such a line unquantified rather than guessing at it.
 *
 * @param raw One ingredient as written, for example "320 g di spaghetti".
 * @returns The parsed parts, with the unit canonicalised and the name normalised.
 */
export function parseIngredientLine(raw: string): ParsedIngredient {
  const collapsed = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
  const toTaste = TO_TASTE.test(collapsed)
  const withoutToTaste = collapsed.replace(TO_TASTE, " ").trim()

  if (toTaste) {
    return {
      raw,
      quantity: null,
      unit: null,
      name: normaliseIngredientName(withoutToTaste),
    }
  }

  const { quantity, rest: afterQuantity } = readQuantity(withoutToTaste)
  const { unit, rest } =
    quantity === null
      ? { unit: null, rest: afterQuantity }
      : readUnit(afterQuantity.trim())

  return { raw, quantity, unit, name: normaliseIngredientName(rest) }
}
```

A unit is read only after a quantity, so "cucchiaio" standing alone as a name is not mistaken for a measure.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/ingredient-parse.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/ingredient-parse.ts lib/services/ingredient-parse.test.ts
git commit -m "feat: add the Italian ingredient line parser"
```

---

### Task 7: The supermarket aisle order

Aisle values stay free-form strings in the database, because they are Italian data and an enum would need a migration to add a shelf. What is not free-form is their order: a list sorted alphabetically walks the shopper back and forth across the shop.

**Files:**

- Create: `lib/aisles.ts`
- Create: `lib/aisles.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `AISLE_UNKNOWN: string`, `AISLE_ORDER: readonly string[]`, `aisleRank(aisle: string): number`

- [ ] **Step 1: Write the failing test**

Create `lib/aisles.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { AISLE_ORDER, AISLE_UNKNOWN, aisleRank } from "@/lib/aisles"

describe("aisleRank", () => {
  it("orders produce before the pantry", () => {
    expect(aisleRank("ortofrutta")).toBeLessThan(aisleRank("dispensa"))
  })

  it("puts the catch-all aisle after every named one", () => {
    const named = AISLE_ORDER.filter((aisle) => aisle !== AISLE_UNKNOWN)
    for (const aisle of named) {
      expect(aisleRank(aisle)).toBeLessThan(aisleRank(AISLE_UNKNOWN))
    }
  })

  it("puts an aisle it has never heard of last", () => {
    expect(aisleRank("reparto immaginario")).toBeGreaterThanOrEqual(
      aisleRank(AISLE_UNKNOWN)
    )
  })

  it("sorts a shuffled list back into walking order", () => {
    const shuffled = [
      "dispensa",
      "reparto immaginario",
      "ortofrutta",
      AISLE_UNKNOWN,
    ]
    expect([...shuffled].sort((a, b) => aisleRank(a) - aisleRank(b))).toEqual([
      "ortofrutta",
      "dispensa",
      AISLE_UNKNOWN,
      "reparto immaginario",
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/aisles.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/aisles"`.

- [ ] **Step 3: Write the implementation**

Create `lib/aisles.ts`:

```ts
// Where an ingredient goes when nothing has been learned about it yet. The user
// assigns a real aisle once and it is remembered from then on.
export const AISLE_UNKNOWN = "altro"

// Walking order through the shop, not alphabetical order. Reorder this to match
// the supermarket actually used; nothing else depends on the positions.
export const AISLE_ORDER = [
  "ortofrutta",
  "panetteria",
  "macelleria",
  "pescheria",
  "salumi e formaggi",
  "banco frigo",
  "surgelati",
  "dispensa",
  "bevande",
  "casa e pulizia",
  AISLE_UNKNOWN,
] as const

export function aisleRank(aisle: string): number {
  const position = AISLE_ORDER.indexOf(aisle as (typeof AISLE_ORDER)[number])
  return position === -1 ? AISLE_ORDER.length : position
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/aisles.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/aisles.ts lib/aisles.test.ts
git commit -m "feat: add the supermarket aisle order"
```

---

### Task 8: The shopping-list aggregator

The highest-value component in the project. It is pure, it is specified entirely by examples, and its failure mode is discovered at the supermarket with a list that lies. It takes plain data and returns plain data — no Prisma, no session, no `Request` — which is what lets every case below be a unit test with no database.

**Files:**

- Create: `lib/services/shopping-aggregate.ts`
- Create: `lib/services/shopping-aggregate.test.ts`

**Interfaces:**

- Consumes: `AISLE_UNKNOWN` and `aisleRank` from `@/lib/aisles`, `HOUSEHOLD_SERVINGS` from `@/lib/config`.
- Produces:
  - `type AggregatorIngredient = { name: string; quantity: number | null; unit: string | null }`
  - `type AggregatorSlot = { servings: number | null; recipe: { servings: number | null; ingredients: AggregatorIngredient[] } | null }`
  - `type ShoppingItem = { name: string; quantity: number | null; unit: string | null; aisle: string; checked: boolean; checkedById: string | null; checkedAt: Date | null; manual: boolean }`
  - `aggregateShoppingList(input: { slots: AggregatorSlot[]; existing: ShoppingItem[]; aisles: Record<string, string> }): ShoppingItem[]`

The service that loads slots from the database and writes the result back arrives in a later plan. This task builds only the function in the middle.

- [ ] **Step 1: Write the failing test**

Create `lib/services/shopping-aggregate.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { AISLE_UNKNOWN } from "@/lib/aisles"
import {
  type AggregatorIngredient,
  type AggregatorSlot,
  type ShoppingItem,
  aggregateShoppingList,
} from "@/lib/services/shopping-aggregate"

const AISLES = {
  spaghetti: "dispensa",
  pomodori: "ortofrutta",
  uova: "banco frigo",
  patate: "ortofrutta",
}

const slot = (
  ingredients: AggregatorIngredient[],
  options: { recipeServings?: number | null; slotServings?: number | null } = {}
): AggregatorSlot => ({
  servings: options.slotServings ?? null,
  recipe: { servings: options.recipeServings ?? 2, ingredients },
})

const item = (overrides: Partial<ShoppingItem>): ShoppingItem => ({
  name: "x",
  quantity: null,
  unit: null,
  aisle: AISLE_UNKNOWN,
  checked: false,
  checkedById: null,
  checkedAt: null,
  manual: false,
  ...overrides,
})

const aggregate = (slots: AggregatorSlot[], existing: ShoppingItem[] = []) =>
  aggregateShoppingList({ slots, existing, aisles: AISLES })

describe("aggregateShoppingList", () => {
  it("sums an ingredient shared by two recipes", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }]),
      slot([{ name: "spaghetti", quantity: 180, unit: "g" }]),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "spaghetti",
      quantity: 500,
      unit: "g",
    })
  })

  it("scales a recipe written for four down to the household default", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], {
        recipeServings: 4,
      }),
    ])

    expect(result[0].quantity).toBe(160)
  })

  it("scales up when the slot overrides the servings", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], {
        recipeServings: 4,
        slotServings: 6,
      }),
    ])

    expect(result[0].quantity).toBe(480)
  })

  it("keeps incompatible units on separate lines instead of coercing them", () => {
    const result = aggregate([
      slot([
        { name: "pomodori", quantity: 200, unit: "g" },
        { name: "pomodori", quantity: 2, unit: null },
      ]),
    ])

    expect(result).toHaveLength(2)
    expect(new Set(result.map((line) => line.unit))).toEqual(
      new Set(["g", null])
    )
  })

  it("collapses unquantified ingredients into one line", () => {
    const result = aggregate([
      slot([{ name: "sale", quantity: null, unit: null }]),
      slot([{ name: "sale", quantity: null, unit: null }]),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "sale",
      quantity: null,
      unit: null,
    })
  })

  it("excludes free-text and empty slots", () => {
    const result = aggregate([
      { servings: null, recipe: null },
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }]),
      { servings: null, recipe: null },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("spaghetti")
  })

  it("rounds a countable quantity up and leaves a weight exact", () => {
    const result = aggregate([
      slot(
        [
          { name: "uova", quantity: 1, unit: null },
          { name: "patate", quantity: 350, unit: "g" },
        ],
        { recipeServings: 4 }
      ),
    ])

    const byName = new Map(result.map((line) => [line.name, line.quantity]))
    expect(byName.get("uova")).toBe(1)
    expect(byName.get("patate")).toBe(175)
  })

  it("keeps manual items across a regeneration", () => {
    const detersivo = item({
      name: "detersivo",
      manual: true,
      aisle: "casa e pulizia",
    })

    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 100, unit: "g" }])],
      [detersivo]
    )

    expect(result).toContainEqual(detersivo)
  })

  it("keeps the checked state of an item that survives a regeneration", () => {
    const checkedAt = new Date("2026-08-13T10:00:00Z")

    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 100, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          unit: "g",
          quantity: 100,
          aisle: "dispensa",
          checked: true,
          checkedById: "user-1",
          checkedAt,
        }),
      ]
    )

    expect(result[0]).toMatchObject({
      checked: true,
      checkedById: "user-1",
      checkedAt,
    })
  })

  it("does not resurrect the checked state of an item under a different unit", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 1, unit: "confezione" }])],
      [item({ name: "spaghetti", unit: "g", checked: true, aisle: "dispensa" })]
    )

    expect(result[0].checked).toBe(false)
  })

  it("sends an ingredient with no learned aisle to the catch-all", () => {
    const result = aggregate([
      slot([{ name: "curcuma", quantity: null, unit: null }]),
    ])

    expect(result[0].aisle).toBe(AISLE_UNKNOWN)
  })

  it("orders the list by aisle, in walking order", () => {
    const result = aggregate([
      slot([
        { name: "spaghetti", quantity: 100, unit: "g" },
        { name: "curcuma", quantity: null, unit: null },
        { name: "pomodori", quantity: 300, unit: "g" },
      ]),
    ])

    expect(result.map((line) => line.name)).toEqual([
      "pomodori",
      "spaghetti",
      "curcuma",
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/services/shopping-aggregate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/services/shopping-aggregate"`.

- [ ] **Step 3: Write the implementation**

Create `lib/services/shopping-aggregate.ts`:

```ts
import { AISLE_UNKNOWN, aisleRank } from "@/lib/aisles"
import { HOUSEHOLD_SERVINGS } from "@/lib/config"

export type AggregatorIngredient = {
  name: string
  quantity: number | null
  unit: string | null
}

export type AggregatorSlot = {
  servings: number | null
  recipe: {
    servings: number | null
    ingredients: AggregatorIngredient[]
  } | null
}

export type ShoppingItem = {
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  checked: boolean
  checkedById: string | null
  checkedAt: Date | null
  manual: boolean
}

// A null unit alongside a quantity means a count of whole things — "2 uova".
const COUNTABLE_UNITS = new Set([
  "pz",
  "spicchio",
  "fetta",
  "foglia",
  "rametto",
  "barattolo",
  "lattina",
  "confezione",
  "bustina",
  "mazzetto",
])

// JSON rather than string concatenation, so a name containing the separator
// cannot forge another line's key, and a null unit stays distinct from "".
const itemKey = (name: string, unit: string | null) =>
  JSON.stringify([name, unit])

const isCountable = (unit: string | null) =>
  unit === null || COUNTABLE_UNITS.has(unit)

// Half an egg left over costs nothing; an egg missing is found at the stove.
// Rounding a weight would instead misstate what the recipe asked for, so weights
// only lose the floating-point noise that scaling introduces.
const round = (quantity: number, unit: string | null) =>
  isCountable(unit) ? Math.ceil(quantity) : Math.round(quantity * 100) / 100

const scaleFactor = (slot: AggregatorSlot) =>
  (slot.servings ?? HOUSEHOLD_SERVINGS) /
  (slot.recipe?.servings ?? HOUSEHOLD_SERVINGS)

type Total = { name: string; unit: string | null; quantity: number | null }

function totalsFor(slots: AggregatorSlot[]): Total[] {
  const totals = new Map<string, Total>()

  for (const slot of slots) {
    if (slot.recipe === null) continue

    const factor = scaleFactor(slot)

    for (const ingredient of slot.recipe.ingredients) {
      // An unquantified ingredient has no unit either, so "olio q.b." from two
      // recipes lands on one key and stays one line.
      const unit = ingredient.quantity === null ? null : ingredient.unit
      const key = itemKey(ingredient.name, unit)
      const current = totals.get(key)

      if (ingredient.quantity === null) {
        if (current === undefined) {
          totals.set(key, { name: ingredient.name, unit: null, quantity: null })
        }
        continue
      }

      totals.set(key, {
        name: ingredient.name,
        unit,
        quantity: (current?.quantity ?? 0) + ingredient.quantity * factor,
      })
    }
  }

  return [...totals.values()]
}

/**
 * Builds the shopping list for a menu, from the recipes its slots point at.
 *
 * Pure and deterministic: it reads no database and holds no state, so a caller
 * loads the slots, the previous list and the learned aisles, and writes back
 * whatever comes out. Slots with no recipe — free text, or empty — contribute
 * nothing. Items added by hand and the checked state of surviving items outlive
 * a regeneration, which is what makes editing the menu safe.
 *
 * @param input Every slot of the menu including the ones with no recipe, the
 *   current list or an empty array on first generation, and the learned aisles
 *   keyed by normalised ingredient name.
 * @returns The new list, sorted by supermarket walking order and then by name.
 */
export function aggregateShoppingList(input: {
  slots: AggregatorSlot[]
  existing: ShoppingItem[]
  aisles: Record<string, string>
}): ShoppingItem[] {
  const { slots, existing, aisles } = input

  const previous = new Map(
    existing
      .filter((line) => !line.manual)
      .map((line) => [itemKey(line.name, line.unit), line])
  )

  const generated = totalsFor(slots).map<ShoppingItem>((total) => {
    const prior = previous.get(itemKey(total.name, total.unit))

    return {
      name: total.name,
      quantity:
        total.quantity === null ? null : round(total.quantity, total.unit),
      unit: total.unit,
      aisle: aisles[total.name] ?? AISLE_UNKNOWN,
      checked: prior?.checked ?? false,
      checkedById: prior?.checkedById ?? null,
      checkedAt: prior?.checkedAt ?? null,
      manual: false,
    }
  })

  const manual = existing.filter((line) => line.manual)

  return [...generated, ...manual].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/services/shopping-aggregate.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the whole gate**

Run: `pnpm verify`
Expected: typecheck clean, lint clean, all tests pass. Report the output, not the intention.

- [ ] **Step 6: Commit**

```bash
git add lib/services/shopping-aggregate.ts lib/services/shopping-aggregate.test.ts
git commit -m "feat: add the shopping list aggregator"
```

---

## Done when

- `pnpm verify` passes.
- `pnpm db:seed` runs twice in a row without error.
- Every case listed under "What is tested" in `docs/conventions/testing.md` for the aggregator and the ingredient parser has a test, and none of them touches a database.

## What this plan does not build, and which plan does

| Next               | Scope                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication** | Blocked on the `better-auth` investigation (design document section 6.4). Delivers `requireSession()` in `lib/auth.ts`, the login screen, credential and session tables, and login rate limiting. Everything after it depends on `requireSession()` and on nothing else about it.      |
| **Recipes**        | `lib/services/recipes.ts`, the recipe list and detail screens, manual create and edit. First use of `parseIngredientLine` against real input, so the parser's fixture table starts growing here.                                                                                       |
| **Import**         | The SSRF-guarded fetcher (section 9.3), the JSON-LD extractor with saved HTML fixtures, `lib/services/llm.ts` as the single Anthropic boundary, the confirmation screen, and the `share_target` manifest entry — including the trap that Chrome delivers the URL in `text`, not `url`. |
| **Menu**           | `lib/services/menu.ts`, the week grid, the slot detail panel with the servings override, cooldown filtering, and LLM proposal with a hand-built menu always possible.                                                                                                                  |
| **Shopping list**  | `lib/services/shopping.ts` around the aggregator built here, the list screen, the tick server action with an optimistic update, `router.refresh()` sync, and one-tap aisle assignment.                                                                                                 |
| **Ship**           | PWA icons and manifest, the Vercel domain CNAME, bootstrapping ~30 recipes with Claude Code, and the manual acceptance checklist on the partner's phone.                                                                                                                               |
