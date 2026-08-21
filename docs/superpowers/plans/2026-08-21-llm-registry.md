# LLM Function Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner opens a screen only they can reach, edits the prompt and the model behind menu generation, presses generate, and sees what the call actually cost and returned — so the prompt can be tuned against real weeks instead of against a guess, without a deploy.

**Architecture:** Two tables. `LlmFunction` is one row per LLM-backed feature, keyed by a stable string id, holding the prompt and the model. `LlmExecution` is what happened, twenty rows deep per function, and because each execution stores the prompt it ran with, it doubles as the version history. Generation reads the row and falls back to the file when there is none, so an empty table cannot take the feature down. Four routes, list to detail to executions to one execution, built from the primitives already in `components/page/`.

**Tech Stack:** Prisma 7 / PostgreSQL, Zod 4, Next.js 16 App Router, React 19, shadcn/ui on Base UI.

**Spec:** `docs/superpowers/specs/2026-08-21-menu-generation-design.md` §7, plus §2 for why the prompts moved out of the filesystem at all.

**Depends on:** `docs/superpowers/plans/2026-08-21-menu-generation.md`, executed and merged. That plan creates `lib/services/llm.ts`, `lib/services/menu-proposal.ts` and `lib/prompts/menu-proposal.ts`, all of which this one modifies. Do not start it first.

## What this plan deliberately does not build

- **Domain parameters, and any general mechanism for them** — spec §7.1. They dissolved: the ranking of the criteria, what recency means, how each criterion is phrased, all of it is prompt text and the prompt is already editable. Do not add a `Json` column, a key-value table, or a parameter editor. If a genuinely numeric per-function parameter ever appears, the spec says what to do then.
- **Editing the output schema.** It is code, it is coupled to what the service does with the result, and a prompt edit must not be able to break it. Task 7 shows it read-only beside the prompt.
- **A second function.** `menu-proposal` is the only row. The registry is general in shape because that costs nothing, not because something else is coming.
- **Rolling back a prompt in one click.** The execution detail shows the prompt that ran; restoring it is selecting and copying. A restore button is a fine second iteration and a bad first one.

## Global Constraints

Identical to the generation plan — the same file binds both. Repeated here because plans are read one at a time.

- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `lib/schemas/**` imports **Zod and nothing else**. ESLint fails the build.
- **The SDK stays confined** to `lib/services/llm.ts`. Nothing in this plan needs to import it.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action. **This plan is where that matters most**: every action here is owner-only.
- **`actorId` is reserved**: an identity already verified by the caller, always from the session, never from a payload. ESLint rejects it in `lib/schemas/`.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws` if it throws. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads.** English for identifiers, comments, TSDoc, commit messages.
- **shadcn/ui only, stay stock.** Base UI, not Radix: `render={<X />}`, never `asChild`.
- **Use the page primitives** in `components/page/`. Do not rebuild one and do not add a boolean prop to one.
- **Schema changes go through a migration.** Never edit the database by hand.
- **`pnpm verify` is the gate.**

## Testing

Per `docs/conventions/testing.md`. Two things here are worth a test, and they are the two that fail silently:

- **The twenty-row retention.** If it is wrong, nothing breaks and the table grows until someone notices the bill.
- **The prompt fallback.** If it is wrong, the feature dies the first time the table is empty — which is exactly the state it ships in.

Not tested: Prisma itself, the screens, the SDK.

## The shell

If a command fails with `"node" non è riconosciuto`, the Git Bash PATH carries a broken `app.asar` entry. Run `pnpm` and `git` through PowerShell, stripping it in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Never `--no-verify`.

---

## File Structure

**Created**

| File                                                          | Responsibility                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `lib/schemas/llm-function.ts`                                 | the edit contract for a function's settings                |
| `lib/schemas/llm-function.test.ts`                            | covers it                                                  |
| `lib/services/llm-registry.ts`                                | read a function with its fallback, update it, record a run |
| `lib/services/llm-registry.test.ts`                           | covers retention and fallback                              |
| `lib/auth/owner.ts`                                           | `requireOwner()` — the one gate for this whole module      |
| `app/(app)/impostazioni/llm/page.tsx`                         | the list of functions                                      |
| `app/(app)/impostazioni/llm/[id]/page.tsx`                    | one function: prompt, model, read-only schema              |
| `app/(app)/impostazioni/llm/[id]/actions.ts`                  | `saveFunction`                                             |
| `app/(app)/impostazioni/llm/[id]/esecuzioni/page.tsx`         | the last twenty                                            |
| `app/(app)/impostazioni/llm/[id]/esecuzioni/[runId]/page.tsx` | one execution in full                                      |
| `components/llm/function-form.tsx`                            | the prompt and model form                                  |

Each of the four routes also needs its `loading.tsx` and `error.tsx`, and the two dynamic ones a `not-found.tsx` — `docs/conventions/ui.md`, "Every route needs four files". They delegate to the page primitives and are not listed individually.

**Modified**

| File                            | Change                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `prisma/schema.prisma`          | `LlmFunction`, `LlmExecution`                                |
| `prisma/seed.ts`                | seeds the `menu-proposal` row from the prompt file           |
| `lib/services/menu-proposal.ts` | reads the prompt from the registry, records the execution    |
| `lib/services/llm.ts`           | takes the model name as an argument instead of reading `env` |
| `components/app-nav.tsx`        | an "Impostazioni" entry, rendered only for the owner         |
| `docs/roadmap.md`               | the registry row moves to "Shipped"                          |

---

## Task 1: The tables

**Files:**

- Modify: `prisma/schema.prisma`
- Create: the migration

**Interfaces:**

- Produces: the `LlmFunction` and `LlmExecution` models, and the generated client types.

- [ ] **Step 1: Add the models**

Append to `prisma/schema.prisma`. The comments follow the file's habit: they explain the decisions that read as odd, not the columns that read as obvious.

```prisma
// One row per LLM-backed feature, keyed by a stable string rather than a cuid:
// the code names the function it wants, and a generated id would mean a lookup
// by a column that is not the key. Today there is exactly one row.
model LlmFunction {
  id          String         @id
  name        String
  description String
  prompt      String
  model       String
  temperature Float          @default(1)
  maxTokens   Int            @default(4096)
  updatedAt   DateTime       @default(now()) @updatedAt
  executions  LlmExecution[]
}

// What one call did. `prompt` is stored per execution on purpose: it is the
// version history, and unlike a table of prompt versions each entry arrives
// attached to the result it produced — design document section 7.3. Kept to the
// most recent twenty per function.
model LlmExecution {
  id         String      @id @default(cuid())
  functionId String
  function   LlmFunction @relation(fields: [functionId], references: [id], onDelete: Cascade)
  prompt     String
  model      String
  // Null when the call never returned one — a timeout reports no usage.
  inputTokens  Int?
  outputTokens Int?
  durationMs   Int
  // The raw text the model answered, kept verbatim so a bad week can be read
  // back rather than guessed at.
  output     String?
  error      String?
  createdAt  DateTime    @default(now())

  // Every read is "the last twenty of this function", in this order.
  @@index([functionId, createdAt])
}
```

- [ ] **Step 2: Create and apply the migration**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:migrate
```

Name it `llm_registry` when prompted.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS. `postinstall` regenerates the client, but `pnpm db:migrate` has already done it.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: a table for what the model was told, and one for what it said"
```

---

## Task 2: The owner gate

One function, used by every route and every action in this module. It exists as its own file so that "who may reach this" is a thing you can read in one place and grep for.

**Files:**

- Create: `lib/auth/owner.ts`

**Interfaces:**

- Consumes: `requireSession` from `@/lib/auth`; `env` from `@/lib/env`.
- Produces: `requireOwner(): Promise<Session>`, `isOwner(email: string): boolean`, `class NotOwnerError extends Error`

- [ ] **Step 1: Read how `requireSession` returns a session**

Open `lib/auth/` and look at what `requireSession()` resolves to and what it does when there is none. Match it. Do not invent a second convention for failure in a module that already has one.

- [ ] **Step 2: Write the gate**

```ts
import "server-only"

import { requireSession } from "@/lib/auth"
import { env } from "@/lib/env"

/** The signed-in user is not the owner. */
export class NotOwnerError extends Error {
  constructor() {
    super("Questa sezione è riservata.")
    this.name = "NotOwnerError"
  }
}

/**
 * Whether an address is the owner's.
 *
 * `OWNER_EMAIL` already exists and already decides which seeded user is which,
 * so this module needs no role column and no migration — design document
 * section 7.4.
 *
 * @param email The address to check.
 * @returns True when it is the owner's, compared case-insensitively.
 */
export function isOwner(email: string): boolean {
  return email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()
}

/**
 * Requires the signed-in user to be the owner.
 *
 * Called inside every server action of this module, not only in the pages: an
 * action is a public endpoint and a page-level check does not protect it.
 *
 * @returns The session, so the caller does not fetch it twice.
 * @throws NotOwnerError When somebody else is signed in.
 */
export async function requireOwner() {
  const session = await requireSession()
  if (!isOwner(session.user.email)) throw new NotOwnerError()
  return session
}
```

Adjust `session.user.email` to whatever shape Step 1 found.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/owner.ts
git commit -m "feat: one place that answers whether you are the owner"
```

---

## Task 3: The edit contract

**Files:**

- Create: `lib/schemas/llm-function.ts`, `lib/schemas/llm-function.test.ts`

**Interfaces:**

- Consumes: nothing. **Zod only.**
- Produces: `LlmFunctionInputSchema`, `type LlmFunctionInput = { prompt: string; model: string; temperature: number; maxTokens: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"

import { LlmFunctionInputSchema } from "./llm-function"

const valid = {
  prompt: "Sei l'assistente che compone il menù.",
  model: "gemini-3.7-flash",
  temperature: 1,
  maxTokens: 4096,
}

describe("LlmFunctionInputSchema", () => {
  it("accepts a complete input", () => {
    expect(LlmFunctionInputSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects an empty prompt, which would leave the model with no instructions", () => {
    const parsed = LlmFunctionInputSchema.safeParse({ ...valid, prompt: "  " })

    expect(parsed.success).toBe(false)
  })

  it("rejects an empty model name", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, model: "" }).success
    ).toBe(false)
  })

  it("rejects a temperature outside the range the API accepts", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, temperature: 3 }).success
    ).toBe(false)
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, temperature: -1 }).success
    ).toBe(false)
  })

  it("rejects a token ceiling of zero", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, maxTokens: 0 }).success
    ).toBe(false)
  })

  it("trims the prompt, so trailing whitespace does not count as a change", () => {
    const parsed = LlmFunctionInputSchema.parse({
      ...valid,
      prompt: "  ciao  ",
    })

    expect(parsed.prompt).toBe("ciao")
  })

  it("reports its errors in Italian", () => {
    const parsed = LlmFunctionInputSchema.safeParse({ ...valid, prompt: "" })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/[àèéìòù]|prompt|vuoto/i)
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/schemas/llm-function.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the schema**

```ts
import { z } from "zod"

/** What the settings screen may change about a function. */
export const LlmFunctionInputSchema = z.object({
  prompt: z.string().trim().min(1, "Il prompt non può essere vuoto."),
  model: z.string().trim().min(1, "Indica un modello."),
  temperature: z
    .number()
    .min(0, "La temperatura va da 0 a 2.")
    .max(2, "La temperatura va da 0 a 2."),
  maxTokens: z
    .number()
    .int()
    .min(1, "Il limite di token deve essere almeno 1."),
})

export type LlmFunctionInput = z.infer<typeof LlmFunctionInputSchema>
```

- [ ] **Step 4: Run the test again**

Expected: PASS, seven tests.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/llm-function.ts lib/schemas/llm-function.test.ts
git commit -m "feat: the contract for editing a function's settings"
```

---

## Task 4: The registry service

**Files:**

- Create: `lib/services/llm-registry.ts`, `lib/services/llm-registry.test.ts`

**Interfaces:**

- Consumes: `db` from `@/lib/db`; `LlmFunctionInput` from `@/lib/schemas/llm-function`.
- Produces:
  - `type LlmSettings = { prompt: string; model: string; temperature: number; maxTokens: number }`
  - `type ExecutionRecord = { functionId: string; prompt: string; model: string; inputTokens: number | null; outputTokens: number | null; durationMs: number; output: string | null; error: string | null }`
  - `getSettings(id: string, fallback: LlmSettings): Promise<LlmSettings>`
  - `updateFunction(id: string, input: LlmFunctionInput): Promise<void>`
  - `recordExecution(record: ExecutionRecord): Promise<void>`
  - `listFunctions()`, `getFunction(id)`, `listExecutions(functionId)`, `getExecution(runId)`
  - `EXECUTION_RETENTION = 20`
  - `idsToPrune(ids: string[], keep: number): string[]`

- [ ] **Step 1: Write the failing test**

Retention is tested through `idsToPrune`, a pure function, rather than against a database. The rule worth protecting is "keep the newest `keep`, drop the rest" — that is arithmetic, and testing it through Prisma would be testing Prisma.

```ts
import { describe, expect, it } from "vitest"

import { EXECUTION_RETENTION, idsToPrune } from "./llm-registry"

describe("idsToPrune", () => {
  it("keeps everything while under the ceiling", () => {
    expect(idsToPrune(["a", "b", "c"], 20)).toEqual([])
  })

  it("keeps exactly the ceiling", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toEqual([])
  })

  it("drops the oldest when one over", () => {
    // Newest first, which is the order the query returns.
    const ids = Array.from({ length: 21 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toEqual(["id-20"])
  })

  it("drops all the surplus at once, not one per call", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toHaveLength(5)
  })

  it("survives an empty history", () => {
    expect(idsToPrune([], 20)).toEqual([])
  })

  it("keeps twenty by default", () => {
    expect(EXECUTION_RETENTION).toBe(20)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/services/llm-registry.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the service**

```ts
import "server-only"

import { db } from "@/lib/db"
import type { LlmFunctionInput } from "@/lib/schemas/llm-function"

/** Design document section 7.3. Bounded so nothing has to be decided later. */
export const EXECUTION_RETENTION = 20

export type LlmSettings = {
  prompt: string
  model: string
  temperature: number
  maxTokens: number
}

export type ExecutionRecord = {
  functionId: string
  prompt: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  output: string | null
  error: string | null
}

/**
 * Which executions are surplus, given the history newest-first.
 *
 * @param ids Execution ids, most recent first.
 * @param keep How many to retain.
 * @returns The ids to delete, empty when the history is within the ceiling.
 */
export function idsToPrune(ids: string[], keep: number): string[] {
  return ids.slice(keep)
}

/**
 * The settings a function should run with.
 *
 * Falls back to the caller's defaults when the row is absent rather than
 * throwing: the table ships empty, and an unseeded database must not take the
 * feature down — design document section 7.2.
 *
 * @param id The function id.
 * @param fallback The defaults compiled into the application.
 * @returns The stored settings, or the fallback.
 */
export async function getSettings(
  id: string,
  fallback: LlmSettings
): Promise<LlmSettings> {
  const row = await db.llmFunction.findUnique({
    where: { id },
    select: { prompt: true, model: true, temperature: true, maxTokens: true },
  })

  return row ?? fallback
}

/**
 * Writes a function's settings.
 *
 * @param id The function id.
 * @param input The validated settings.
 * @returns Nothing.
 */
export async function updateFunction(
  id: string,
  input: LlmFunctionInput
): Promise<void> {
  await db.llmFunction.update({ where: { id }, data: input })
}

/**
 * Records one call and prunes the history back to the retention ceiling.
 *
 * @param record What the call was and what it did.
 * @returns Nothing.
 */
export async function recordExecution(record: ExecutionRecord): Promise<void> {
  await db.llmExecution.create({ data: record })

  const ids = await db.llmExecution.findMany({
    where: { functionId: record.functionId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const surplus = idsToPrune(
    ids.map((row) => row.id),
    EXECUTION_RETENTION
  )

  if (surplus.length > 0) {
    await db.llmExecution.deleteMany({ where: { id: { in: surplus } } })
  }
}

/**
 * Every registered function, for the list screen.
 *
 * @returns The functions, by name.
 */
export async function listFunctions() {
  return db.llmFunction.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      model: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  })
}

/**
 * One function's full settings.
 *
 * @param id The function id.
 * @returns The row, or null when there is none.
 */
export async function getFunction(id: string) {
  return db.llmFunction.findUnique({ where: { id } })
}

/**
 * The retained executions of a function, most recent first.
 *
 * @param functionId The function id.
 * @returns Up to `EXECUTION_RETENTION` rows, without the bulky text columns.
 */
export async function listExecutions(functionId: string) {
  return db.llmExecution.findMany({
    where: { functionId },
    orderBy: { createdAt: "desc" },
    take: EXECUTION_RETENTION,
    select: {
      id: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      durationMs: true,
      error: true,
      createdAt: true,
    },
  })
}

/**
 * One execution, with the prompt and the output it carried.
 *
 * @param runId The execution id.
 * @returns The row, or null.
 */
export async function getExecution(runId: string) {
  return db.llmExecution.findUnique({ where: { id: runId } })
}
```

- [ ] **Step 4: Run the test again**

Expected: PASS, six tests.

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/services/llm-registry.ts lib/services/llm-registry.test.ts
git commit -m "feat: the registry, and a history that stops at twenty"
```

---

## Task 5: The seed

**Files:**

- Modify: `prisma/seed.ts`

- [ ] **Step 1: Read how the seed upserts today**

It seeds users and the ingredient catalogue. Follow its shape. Note the roadmap's warning about seeding over an edited catalogue — it does not apply to a table that starts empty, but the upsert habit does.

- [ ] **Step 2: Seed the function from the prompt file**

The prompt file is the source of the default; the row is a copy that may then drift. Upsert on the id, and **do not overwrite `prompt` on update** — reseeding must not silently discard the tuning the screen exists to enable.

```ts
await db.llmFunction.upsert({
  where: { id: "menu-proposal" },
  // An existing row has been edited by hand. Reseeding refreshes what is
  // descriptive and leaves what is tuned.
  update: { name: "Generazione menù", description: "..." },
  create: {
    id: "menu-proposal",
    name: "Generazione menù",
    description:
      "Compone i quattordici pasti della settimana scegliendo fra le ricette disponibili.",
    prompt: MENU_PROPOSAL_PROMPT,
    model: process.env.GEMINI_MODEL ?? "gemini-3.7-flash",
  },
})
```

- [ ] **Step 3: Run it and confirm the row exists**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm db:seed
pnpm db:studio
```

Expected: one `LlmFunction` row, `menu-proposal`, its prompt matching the file.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed the function, and never seed over a tuned prompt"
```

---

## Task 6: Generation reads the registry

The point of the whole plan. Until this task, editing a prompt changes nothing.

**Files:**

- Modify: `lib/services/llm.ts`, `lib/services/menu-proposal.ts`

**Interfaces:**

- `callMenuProposal` gains three fields on its input: `model: string`, `temperature: number`, `maxTokens: number`. It stops reading `env.GEMINI_MODEL` — the caller decides, because the caller is the one that knows about the registry. `env.GEMINI_MODEL` survives as the fallback in `menu-proposal.ts` and as the seed value.
- `callMenuProposal`'s result gains `raw: string`, the unparsed text, for the execution record.

- [ ] **Step 1: Move the model out of the boundary**

In `lib/services/llm.ts`, add `model`, `temperature` and `maxTokens` to `LlmProposalInput` and pass them to `generateText` (`temperature`, and `maxOutputTokens` — check the name against the installed `ai` package as the generation plan's Task 5 did). Delete the `env` import if nothing else in the file uses it.

Return the raw text alongside the parsed proposal: the execution record stores what the model actually said, and by the time it is parsed that is gone.

- [ ] **Step 2: Read the settings and time the call**

In `lib/services/menu-proposal.ts`, inside `proposeMenu`, replace the direct use of `MENU_PROPOSAL_PROMPT` with:

```ts
const settings = await getSettings("menu-proposal", {
  prompt: MENU_PROPOSAL_PROMPT,
  model: env.GEMINI_MODEL,
  temperature: 1,
  maxTokens: 4096,
})
```

The file keeps importing `MENU_PROPOSAL_PROMPT`: it is the fallback, not a leftover.

- [ ] **Step 3: Record every call, successful or not**

Wrap the call so both paths write a row. The record must not be able to take the generation down — spec §8: history is diagnostics, and losing a row must not lose a menu.

```ts
const startedAt = Date.now()
let result: LlmProposalResult | undefined
let failure: unknown

try {
  result = await callMenuProposal({
    ...settings,
    request,
    candidateCount: index.count,
  })
} catch (error) {
  failure = error
}

// Never let bookkeeping fail a generation.
await recordExecution({
  functionId: "menu-proposal",
  prompt: settings.prompt,
  model: settings.model,
  inputTokens: result?.inputTokens ?? null,
  outputTokens: result?.outputTokens ?? null,
  durationMs: Date.now() - startedAt,
  output: result?.raw ?? null,
  error: failure instanceof Error ? failure.message : null,
}).catch(() => {})

if (failure !== undefined) throw failure
```

Use `Date.now()` and not a clock abstraction: nothing here is tested against time.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS. The generation plan's tests still pass — `resolveProposal` did not move.

- [ ] **Step 5: Confirm end to end in the browser**

Generate a week, then open Prisma Studio: one new `LlmExecution` row, with the prompt, the token counts and the duration filled in. Then edit the row's prompt in Studio — change a word in the criteria — generate again, and confirm the new execution carries the edited prompt. That is the whole feature, before any screen exists.

- [ ] **Step 6: Commit**

```bash
git add lib/services/llm.ts lib/services/menu-proposal.ts
git commit -m "feat: generation reads the row, falls back to the file, and records what it did"
```

---

## Task 7: The screens

**Files:**

- Create: the four routes listed in File Structure, their `loading.tsx` and `error.tsx`, `not-found.tsx` on the two dynamic ones, `components/llm/function-form.tsx`, `app/(app)/impostazioni/llm/[id]/actions.ts`
- Modify: `components/app-nav.tsx`

- [ ] **Step 1: Read `docs/conventions/ui.md` end to end**

Not a skim. It is a manual, it lists the primitives with their props, and it explains `useFormState`, `PageForm` and the `form.attempt` remount habit that keeps a refused save from emptying the fields. This task is four screens of exactly the kind it describes; writing them without reading it means rebuilding a primitive that exists.

- [ ] **Step 2: The list**

`app/(app)/impostazioni/llm/page.tsx`. A server component. `await requireOwner()` first — before any query. `listFunctions()`, then `DataList` with a row per function showing the name, the description and the model. Each row links to `/impostazioni/llm/[id]`.

With one function this list looks thin. Leave it: the detail screen needs a parent to go back to, and the alternative is a route that redirects to its only child and breaks the day there are two.

- [ ] **Step 3: The detail and its form**

`app/(app)/impostazioni/llm/[id]/page.tsx`: `requireOwner()`, `getFunction(id)`, `notFound()` when absent. Renders `FunctionForm` plus, **read-only**, the output schema — spec §7.1. A `<pre>` naming the fourteen slots and stating that `candidate` is a one-based index bounded by the number of candidates. It is not editable and the page must make that obvious; the reason is that a prompt edit must never be able to break the contract the service parses against.

`components/llm/function-form.tsx`: `useFormState` over `saveFunction`, a `Textarea` for the prompt — tall, it is the field that matters — and inputs for model, temperature and maxTokens. `PageForm` supplies the shell, the message and the footer.

`actions.ts`:

```ts
"use server"

export async function saveFunction(_: FormState, formData: FormData) {
  const parsed = LlmFunctionInputSchema.safeParse({
    prompt: formData.get("prompt"),
    model: formData.get("model"),
    temperature: Number(formData.get("temperature")),
    maxTokens: Number(formData.get("maxTokens")),
  })
  if (!parsed.success) return failure(parsed.error, formData)

  await requireOwner()

  const id = String(formData.get("id"))
  await updateFunction(id, parsed.data)
  revalidatePath(`/impostazioni/llm/${id}`)
  // …the success shape the other actions in this repo return
}
```

Validate, then authenticate and authorise, then mutate. In that order, in the action, per `CLAUDE.md` — the page's `requireOwner()` does not protect this.

- [ ] **Step 4: The executions**

`app/(app)/impostazioni/llm/[id]/esecuzioni/page.tsx`: `requireOwner()`, `listExecutions(id)`, a `DataList` of rows showing the timestamp, the duration, the token counts, and — where `error` is set — that it failed. `EmptyState` when there are none. Format the timestamp with `Intl`, never a format string.

`.../esecuzioni/[runId]/page.tsx`: `requireOwner()`, `getExecution(runId)`, `notFound()` when absent. Shows the prompt that ran, the raw output and the error, each in a `<pre>` that wraps. This is the screen that makes the history a version history, so the prompt must be selectable and copyable — do not truncate it behind a "mostra tutto".

Both need a back link naming its destination, per the parent spec §4.3.

- [ ] **Step 5: The navigation entry, owner only**

In `components/app-nav.tsx`, add "Impostazioni" pointing at `/impostazioni/llm`. It must render **only for the owner** — pass the flag down from a server component using `isOwner`, rather than importing `env` into a client component, which the layering rule forbids anyway.

Hiding a link is not access control. `requireOwner()` in every page and action is; this only stops the partner from finding a door that would refuse her.

- [ ] **Step 6: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 7: Run `web-design-guidelines` over the changed files**

`CLAUDE.md`: UI work is not done until it has been run and its findings addressed or explicitly dismissed. Four new screens and a form — this is the largest UI surface in either plan.

- [ ] **Step 8: Manual browser check, at 390px**

1. Signed in as the owner: "Impostazioni" is in the menu, and the list shows one function.
2. Open it. The prompt is there, tall enough to read, and the output schema is beside it and not editable.
3. Change a word in the prompt, save. The success message appears and the text survives the round trip.
4. Reload. The change is still there.
5. Generate a week from `/menu`. Come back to the executions list: a new row, with tokens and duration.
6. Open it. The prompt shown is the edited one, and the raw output is readable.
7. Break the key in `.env`, restart, generate, come back: the failed execution is listed **and marked as failed**, with the error on its detail. **Put the key back.**
8. Sign in as the partner. "Impostazioni" is not in the menu, and typing `/impostazioni/llm` by hand is refused rather than rendered.
9. Submit the form with an empty prompt: an Italian message, and nothing saved.

Point 8 is the one that matters. If it renders for the partner, stop and fix it before anything else in this list.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/impostazioni" components/llm components/app-nav.tsx
git commit -m "feat: the screen where the prompt is tuned against the weeks it produced"
```

---

## Task 8: The roadmap

- [ ] **Step 1: Move the row**

A "Shipped" row for `2026-08-21-llm-registry`, naming what it left: the two tables, `requireOwner()`, the four screens, and generation reading its prompt from the database.

- [ ] **Step 2: Record the two things a future session needs**

Under the standing decisions, briefly:

- The prompt lives in the database and the file is the fallback, so **editing `lib/prompts/menu-proposal.ts` changes nothing on a seeded database**. That is the single most likely wasted hour in this module.
- `requireOwner()` is the gate for owner-only surfaces, built on `OWNER_EMAIL`. Anything else owner-only uses it rather than inventing a check.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: the registry ships, and the prompt file stops being where the prompt lives"
```

---

## Self-review notes

Checked against spec §7 after writing:

- §7.1 the row and its fields → Task 1. Domain parameters and schema editing excluded, as the spec excludes them.
- §7.2 defaults and fallback → Task 4 `getSettings`, Task 5 the seed, Task 6 the call site.
- §7.3 execution history, prompt-per-execution, twenty rows → Tasks 1, 4, 6.
- §7.4 the four routes and the `OWNER_EMAIL` gate → Tasks 2 and 7.
- §8 losing a row must not lose a generation → Task 6, the `.catch(() => {})`.

**One risk this plan accepts.** `recordExecution` runs after the model answers and before `proposeMenu` returns, so a slow write lengthens a call the user is watching. At one generation a week against two small rows this is not worth solving, and the alternatives — a queue, `after()` — cost more than they save here. If the registry ever backs a high-frequency function, this is the first thing to revisit.
