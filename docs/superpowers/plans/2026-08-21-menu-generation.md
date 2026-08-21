# Menu Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner opens a week, asks for a proposal, and the fourteen-slot grid comes back pre-filled with recipes chosen against four criteria — with the whole thing still editable by hand and still working when the API is down.

**Architecture:** One call to Gemini through the Vercel AI SDK, behind `lib/services/llm.ts`, which is the only file allowed to import the SDK. The service numbers the candidate recipes `1..N` and the model returns integers, so a hallucinated recipe cannot be expressed rather than having to be detected. Candidate assembly and index mapping are pure functions with no SDK in sight, and they carry the tests; the SDK call itself is thin enough not to need one. The proposal writes the slots it fills, and is offered only on a week where every slot is empty — so there is never anything to overwrite, and the grid stays the source of truth without a second copy of it living in client state.

**Tech Stack:** Vercel AI SDK (`ai` v7, `@ai-sdk/google`), Gemini `gemini-3.7-flash`, Zod 4, Prisma 7 / PostgreSQL, Next.js 16 App Router, React 19, shadcn/ui on Base UI.

**Spec:** `docs/superpowers/specs/2026-08-21-menu-generation-design.md` — all of it. It amends three decisions of the parent spec `2026-08-13-menu-spesa-design.md`; read §2 of the child first or you will implement the retired versions.

## What this plan deliberately does not build

- **The LLM function registry and its screen** — spec §7. It is the next plan. This one reads the prompt from a file, which spec §7.2 makes the permanent fallback anyway, so nothing here is thrown away when the registry lands.
- **Recipe import via LLM** — spec §10. Excluded on the owner's call. `lib/services/llm.ts` exposes `proposeMenu` and nothing else. Do not add `structureRecipe`, `parseIngredientLines` or `guessAisles`, however much the parent spec §7.1 lists them.
- **Regenerating a single slot or a single day** — spec §10. Whole week only.
- **Streaming**, and **cost controls** — spec §10.

## Global Constraints

- **Layering.** `lib/services/` imports no React, no `next/*`, no `app/**`, no `components/**`. `lib/schemas/**` imports **Zod and nothing else**. ESLint fails the build.
- **The SDK is confined.** No file outside `lib/services/llm.ts` may import `ai` or `@ai-sdk/*`. Task 1 re-points the existing ESLint rule, which today names `@anthropic-ai/sdk`.
- **A server action is a public endpoint.** Validate with Zod, then authenticate, then authorise, then mutate — in that order, inside the action.
- **`actorId` is reserved**: it means an identity already verified by the caller, always from the session, never from a payload. ESLint rejects it in `lib/schemas/`.
- **Every exported function in `lib/services/` carries a TSDoc block**: summary, `@param`, `@returns`, `@throws` if it throws. No types — TypeScript has those. ESLint enforces it; private helpers are exempt.
- **Italian for everything the user reads**, including every Zod message and every error surfaced in the UI. English for identifiers, comments, TSDoc, commit messages, this plan.
- **shadcn/ui is the only component library.** Stay stock; nothing in `components/ui/` is edited. Base UI, not Radix: `render={<X />}`, never `asChild`.
- **Use the page primitives** in `components/page/`. Do not rebuild one and do not add a boolean prop to one.
- **Dates.** `Menu.weekStart` is a Postgres `date`. Which week a moment falls in is decided in `APP_TIMEZONE`, never the server's timezone. `MenuSlot.day` is `0 = Monday … 6 = Sunday`, which is **not** `Date.getDay()`. It is all in `lib/week.ts`, already written and tested — call it.
- **No secret in the repository.** Names in `.env.example`, values in `.env` locally and in Vercel Environment Variables in production.
- **`pnpm verify` is the gate.** Typecheck, lint, tests. Run it before claiming a task done.

## Testing

Per `docs/conventions/testing.md`, which binds over this skill's test-first default. Vitest, `environment: "node"`, no DOM. Tests sit beside the code as `*.test.ts`.

**Tested here:** candidate assembly, the proposal schema, index mapping and duplicate rejection. All pure, all cheap.

**Not tested:** the SDK, the model, prompt wording, React components. Spec §9 puts LLM output quality outside the test suite — it is evaluated by use. Component tasks verify with `pnpm verify` plus the written browser check in Task 7.

## Two environment notes

**The shell.** If a command fails with `"node" non è riconosciuto`, the Git Bash PATH carries a broken `app.asar` entry. Run `pnpm` and `git` through PowerShell instead, stripping the entry in the same call:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm verify
```

Never `--no-verify`.

**No migration.** This plan touches no table. `Recipe`, `MenuSlot` and `Menu` all exist. The registry tables belong to the next plan. If you find yourself writing a migration, stop — you have misread the scope.

---

## File Structure

**Created**

| File                                   | Responsibility                                                      |
| -------------------------------------- | ------------------------------------------------------------------- |
| `lib/schemas/menu-proposal.ts`         | the contract the model must answer in, and the parsed proposal type |
| `lib/schemas/menu-proposal.test.ts`    | covers it                                                           |
| `lib/services/menu-candidates.ts`      | pure: recipes + recency → numbered candidate lines                  |
| `lib/services/menu-candidates.test.ts` | covers it                                                           |
| `lib/services/menu-proposal.ts`        | the orchestration: gather, call, map back, validate                 |
| `lib/services/menu-proposal.test.ts`   | covers mapping and rejection, with the LLM stubbed                  |
| `lib/services/llm.ts`                  | the single boundary to the AI SDK — `proposeMenu` and nothing else  |
| `lib/prompts/menu-proposal.ts`         | the default prompt, in a file of its own                            |
| `components/menu/generate-button.tsx`  | the button, the waiting dialog and the failure dialog               |

**Modified**

| File                                    | Change                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `package.json`                          | `ai` and `@ai-sdk/google`                                                 |
| `.env.example`                          | `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL`                            |
| `lib/env.ts`                            | the same two, validated                                                   |
| `eslint.config.mjs`                     | the confinement rule moves from `@anthropic-ai/sdk` to `ai` / `@ai-sdk/*` |
| `lib/config.ts`                         | `DEFAULT_COOLDOWN_DAYS` removed, `RECENCY_WINDOW_WEEKS` added             |
| `app/(app)/menu/[weekStart]/actions.ts` | `generateWeek`                                                            |
| `app/(app)/menu/[weekStart]/page.tsx`   | renders the button                                                        |
| `docs/roadmap.md`                       | the menu-generation row moves out of "Not started"                        |

---

## Task 1: The dependencies, the environment and the confinement rule

Nothing calls an LLM yet. This task makes it possible to, and makes it impossible to do it from the wrong file.

**Files:**

- Modify: `package.json`, `.env.example`, `lib/env.ts`, `eslint.config.mjs`, `lib/config.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `env.GOOGLE_GENERATIVE_AI_API_KEY: string`, `env.GEMINI_MODEL: string`, and `RECENCY_WINDOW_WEEKS: number` from `lib/config.ts`.

- [ ] **Step 1: Install the SDK**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm add ai @ai-sdk/google
```

- [ ] **Step 2: Add the two variables to `.env.example`**

Empty values — the file documents names, never secrets.

```
# Google AI Studio (aistudio.google.com), not Google Cloud. A plain API key.
GOOGLE_GENERATIVE_AI_API_KEY=
# The model menu generation runs on. Changing it must not need a code edit.
GEMINI_MODEL=gemini-3.7-flash
```

- [ ] **Step 3: Add them to `lib/env.ts`**

Inside `EnvSchema`, after `PARTNER_EMAIL`. The comment style matches the file: say why, not what.

```ts
  // Google AI Studio, not the Cloud Agent Platform: express-mode keys are not
  // accepted by @ai-sdk/google. See the design document section 3.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  // Design section 3 chose gemini-3.7-flash. It lives here so the next model
  // is an environment change, not a deploy.
  GEMINI_MODEL: z.string().min(1).default("gemini-3.7-flash"),
```

- [ ] **Step 4: Put a real key in `.env`**

`GOOGLE_GENERATIVE_AI_API_KEY` from aistudio.google.com. Without it every command below fails at import time, because `lib/env.ts` throws on an invalid environment — which is the intended behaviour, not a bug to work around.

- [ ] **Step 5: Re-point the ESLint confinement rule**

In `eslint.config.mjs`, `noAnthropicSdk` (around line 51) names a provider this project no longer uses. Replace it, keeping the same shape and the same wiring at its use site:

```js
const noLlmSdk = {
  group: ["ai", "@ai-sdk/*", "@ai-sdk/**"],
  message:
    "Every LLM call goes through lib/services/llm.ts, so the provider stays replaceable.",
}
```

Rename every reference to `noAnthropicSdk` accordingly. The rule must exempt `lib/services/llm.ts` itself exactly as the old one exempted it — check the override block and move it if it names the file.

- [ ] **Step 6: Swap the constant in `lib/config.ts`**

Delete `DEFAULT_COOLDOWN_DAYS` and its comment. Its comment argues for the filter that spec §2 retires, so leaving it is worse than leaving nothing. Add:

```ts
// How far back a recipe is worth remembering. Beyond this, "cooked four months
// ago" and "never cooked" say the same thing and only cost tokens.
export const RECENCY_WINDOW_WEEKS = 8
```

- [ ] **Step 7: Verify**

Run: `pnpm verify`
Expected: PASS. If a file still imports `DEFAULT_COOLDOWN_DAYS`, it has no caller today and the typecheck will name it.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example lib/env.ts eslint.config.mjs lib/config.ts
git commit -m "chore: the AI SDK, and a confinement rule that names the provider in use"
```

---

## Task 2: The proposal contract

The schema the model must answer in. It is the whole defence against a hallucinated recipe, so it is written before anything can call it.

**Files:**

- Create: `lib/schemas/menu-proposal.ts`, `lib/schemas/menu-proposal.test.ts`

**Interfaces:**

- Consumes: nothing. **Zod only** — ESLint rejects any other import in `lib/schemas/`.
- Produces:
  - `menuProposalSchema(candidateCount: number): z.ZodType<MenuProposal>`
  - `type MenuProposal = { slots: ProposedSlot[] }`
  - `type ProposedSlot = { day: number; meal: "LUNCH" | "DINNER"; candidate: number | null }`

- [ ] **Step 1: Write the failing test**

`lib/schemas/menu-proposal.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { menuProposalSchema } from "./menu-proposal"

const slot = (
  day: number,
  meal: "LUNCH" | "DINNER",
  candidate: number | null
) => ({
  day,
  meal,
  candidate,
})

describe("menuProposalSchema", () => {
  it("accepts a slot pointing at a candidate in range", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 12)],
    })

    expect(parsed.success).toBe(true)
  })

  it("accepts an empty slot, because the model may decline to fill one", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", null)],
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects a candidate above the count, which is how a hallucination arrives", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 31)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects candidate zero, because candidates are numbered from one", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 0)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a non-integer candidate", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 1.5)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a day outside the week", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(7, "LUNCH", 1)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a meal that is not one of the two", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [{ day: 0, meal: "BRUNCH", candidate: 1 }],
    })

    expect(parsed.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm test lib/schemas/menu-proposal.test.ts
```

Expected: FAIL — `Failed to resolve import "./menu-proposal"`.

- [ ] **Step 3: Write the schema**

`lib/schemas/menu-proposal.ts`:

```ts
import { z } from "zod"

/**
 * The shape the model must answer a menu proposal in.
 *
 * `candidate` is a one-based index into the numbered list the prompt carried,
 * never a recipe id: an index can be bounded by the schema, so a recipe that
 * does not exist becomes impossible to express rather than something to detect
 * afterwards. Mapping back to ids is the service's job.
 */
export function menuProposalSchema(candidateCount: number) {
  return z.object({
    slots: z.array(
      z.object({
        day: z.number().int().min(0).max(6),
        meal: z.enum(["LUNCH", "DINNER"]),
        candidate: z.number().int().min(1).max(candidateCount).nullable(),
      })
    ),
  })
}

export type MenuProposal = z.infer<ReturnType<typeof menuProposalSchema>>
export type ProposedSlot = MenuProposal["slots"][number]
```

- [ ] **Step 4: Run the test again**

Expected: PASS, seven tests.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/menu-proposal.ts lib/schemas/menu-proposal.test.ts
git commit -m "feat: a proposal contract a hallucinated recipe cannot satisfy"
```

---

## Task 3: Candidate assembly

Turning recipes and their history into the numbered lines the prompt carries. Pure, no database, no SDK — which is why it is the piece worth testing hardest.

**Files:**

- Create: `lib/services/menu-candidates.ts`, `lib/services/menu-candidates.test.ts`

**Interfaces:**

- Consumes: `RECENCY_WINDOW_WEEKS` from `@/lib/config`.
- Produces:
  - `type CandidateRecipe = { id: string; title: string; totalMinutes: number | null; tags: string[]; ingredients: string[]; lastCookedDaysAgo: number | null }`
  - `buildCandidateLines(recipes: CandidateRecipe[]): string`
  - `type CandidateIndex = { byNumber: Map<number, string>; count: number }`
  - `indexCandidates(recipes: CandidateRecipe[]): CandidateIndex`

- [ ] **Step 1: Write the failing test**

`lib/services/menu-candidates.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  buildCandidateLines,
  indexCandidates,
  type CandidateRecipe,
} from "./menu-candidates"

const recipe = (over: Partial<CandidateRecipe> = {}): CandidateRecipe => ({
  id: "r1",
  title: "Spaghetti aglio e olio",
  totalMinutes: 15,
  tags: ["veloce", "vegetariano"],
  ingredients: ["spaghetti", "aglio fresco", "peperoncino"],
  lastCookedDaysAgo: null,
  ...over,
})

describe("buildCandidateLines", () => {
  it("numbers from one, because the schema bounds a one-based index", () => {
    const lines = buildCandidateLines([
      recipe(),
      recipe({ id: "r2", title: "Pollo" }),
    ])

    expect(lines).toContain("1. Spaghetti aglio e olio")
    expect(lines).toContain("2. Pollo")
  })

  it("carries the minutes, the tags and the ingredients, which the criteria need", () => {
    const lines = buildCandidateLines([recipe()])

    expect(lines).toContain("15min")
    expect(lines).toContain("veloce")
    expect(lines).toContain("spaghetti")
  })

  it("never carries the instructions", () => {
    // Guarded by the type: CandidateRecipe has no instructions field. This test
    // states the intent so nobody widens the type without meeting it.
    const line = buildCandidateLines([recipe()])

    expect(line).not.toContain("Cuocere")
  })

  it("marks how long ago a recipe was last cooked", () => {
    const lines = buildCandidateLines([recipe({ lastCookedDaysAgo: 9 })])

    expect(lines).toContain("9")
  })

  it("says nothing about recency for a recipe never scheduled", () => {
    const lines = buildCandidateLines([recipe({ lastCookedDaysAgo: null })])

    expect(lines.toLowerCase()).not.toContain("giorni fa")
  })

  it("omits a missing duration rather than inventing one", () => {
    const lines = buildCandidateLines([recipe({ totalMinutes: null })])

    expect(lines).not.toContain("min")
  })

  it("survives a recipe with no tags and no ingredients", () => {
    const lines = buildCandidateLines([recipe({ tags: [], ingredients: [] })])

    expect(lines).toContain("1. Spaghetti aglio e olio")
  })
})

describe("indexCandidates", () => {
  it("maps each number back to its recipe id", () => {
    const index = indexCandidates([recipe(), recipe({ id: "r2" })])

    expect(index.byNumber.get(1)).toBe("r1")
    expect(index.byNumber.get(2)).toBe("r2")
    expect(index.count).toBe(2)
  })

  it("counts zero for an empty book without throwing", () => {
    expect(indexCandidates([]).count).toBe(0)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/services/menu-candidates.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

`lib/services/menu-candidates.ts`:

```ts
/**
 * A recipe as the proposal sees it. Deliberately not the Prisma model: the
 * instructions are most of a recipe's tokens and play no part in deciding
 * whether to schedule it on Tuesday, so they are not representable here.
 */
export type CandidateRecipe = {
  id: string
  title: string
  totalMinutes: number | null
  tags: string[]
  ingredients: string[]
  lastCookedDaysAgo: number | null
}

export type CandidateIndex = {
  byNumber: Map<number, string>
  count: number
}

function describe(recipe: CandidateRecipe, position: number): string {
  const parts = [`${position}. ${recipe.title}`]

  if (recipe.totalMinutes !== null) parts.push(`${recipe.totalMinutes}min`)
  if (recipe.tags.length > 0) parts.push(recipe.tags.join(", "))
  if (recipe.ingredients.length > 0) parts.push(recipe.ingredients.join(", "))
  if (recipe.lastCookedDaysAgo !== null) {
    parts.push(`ultima volta ${recipe.lastCookedDaysAgo} giorni fa`)
  }

  return parts.join(" — ")
}

/**
 * Renders the candidates as the numbered block the prompt carries.
 *
 * The numbering is one-based and must stay in step with `indexCandidates`,
 * which reads the same array in the same order — that pairing is what makes an
 * integer answer safe to map back to a recipe.
 *
 * @param recipes The candidates, in the order they will be numbered.
 * @returns One line per recipe, newline separated.
 */
export function buildCandidateLines(recipes: CandidateRecipe[]): string {
  return recipes.map((recipe, i) => describe(recipe, i + 1)).join("\n")
}

/**
 * Builds the lookup from the numbers in the prompt back to recipe ids.
 *
 * @param recipes The same array, in the same order, as `buildCandidateLines`.
 * @returns The number-to-id map and how many candidates there are.
 */
export function indexCandidates(recipes: CandidateRecipe[]): CandidateIndex {
  return {
    byNumber: new Map(recipes.map((recipe, i) => [i + 1, recipe.id])),
    count: recipes.length,
  }
}
```

- [ ] **Step 4: Run the test again**

Expected: PASS, nine tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/menu-candidates.ts lib/services/menu-candidates.test.ts
git commit -m "feat: candidates as numbered lines, without the instructions nobody schedules by"
```

---

## Task 4: The prompt

A file of its own, so it can be read and diffed. Spec §7.2 keeps this file permanently: when the registry lands it seeds the editable row and remains the fallback.

**Files:**

- Create: `lib/prompts/menu-proposal.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `MENU_PROPOSAL_PROMPT: string`, `buildMenuProposalRequest(input: { candidates: string; month: string; servings: number; filled: string }): string`

- [ ] **Step 1: Write the prompt file**

Spec §5 is the authority for the ordering. It is stated as a hierarchy on purpose: the criteria contradict each other, and without an order the model improvises a different balance every week.

```ts
/**
 * The instructions for the menu proposal. Italian, because it reasons about
 * Italian cooking and seasonality; the surrounding code stays English.
 *
 * The hierarchy in the third block is not decoration — the criteria conflict by
 * construction, and design section 5 ranks them. Reuse sits first on the
 * owner's call, and the recency nudge below it is what stops a week from
 * turning into one ingredient cooked seven ways.
 */
export const MENU_PROPOSAL_PROMPT = `Sei l'assistente che compone il menù settimanale di una famiglia italiana.

Ricevi un elenco numerato di ricette disponibili. Devi proporre i pasti della settimana scegliendo SOLO da quell'elenco, indicando ogni ricetta con il suo numero.

REGOLA ASSOLUTA: nessuna ricetta può comparire due volte nella stessa settimana.

Criteri di scelta, in ordine di importanza decrescente:
1. RIUSO DEGLI INGREDIENTI FRESCHI — preferisci combinazioni in cui un ingrediente deperibile (prezzemolo, panna, verdure fresche) viene consumato da due piatti invece che da uno solo. Riduce sprechi e spesa.
2. EQUILIBRIO DELLA SETTIMANA — distribuisci pesce, carne e piatti vegetariani lungo la settimana. Metti i piatti veloci nei giorni feriali e quelli più lunghi nel fine settimana.
3. STAGIONALITÀ — preferisci ingredienti di stagione in Italia nel mese indicato.

Preferenza aggiuntiva, più debole di tutte le precedenti: a parità di condizioni scegli le ricette cucinate meno di recente. Ripetere da una settimana all'altra è accettabile; non lo è riempire la settimana solo con le ricette appena cucinate.

Se le ricette disponibili non bastano a comporre una settimana sensata, lascia vuoti gli slot che non sai riempire invece di ripetere una ricetta.`

/**
 * Assembles the per-request part of the prompt: the data that changes every
 * time, kept apart from the instructions that do not.
 *
 * @param input The numbered candidates, the month for seasonality, the
 * household size, and a description of the slots already filled by hand.
 * @returns The user message accompanying the instructions.
 */
export function buildMenuProposalRequest(input: {
  candidates: string
  month: string
  servings: number
  filled: string
}): string {
  return `Mese: ${input.month}
Persone: ${input.servings}

Ricette disponibili:
${input.candidates}

${input.filled}

Proponi i pasti per i sette giorni della settimana, pranzo e cena.`
}
```

- [ ] **Step 2: Verify**

Run: `pnpm verify`
Expected: PASS. Nothing imports the file yet; this confirms it typechecks and lints.

- [ ] **Step 3: Commit**

```bash
git add lib/prompts/menu-proposal.ts
git commit -m "feat: the proposal prompt, with the criteria ranked rather than listed"
```

---

## Task 5: The LLM boundary

The only file in the repository allowed to import the SDK. Thin on purpose: everything decidable lives in the pure modules on either side of it.

**Files:**

- Create: `lib/services/llm.ts`

**Interfaces:**

- Consumes: `env` from `@/lib/env`; `menuProposalSchema` from `@/lib/schemas/menu-proposal`.
- Produces:
  - `type LlmProposalInput = { instructions: string; request: string; candidateCount: number }`
  - `type LlmProposalResult = { proposal: MenuProposal; inputTokens: number; outputTokens: number }`
  - `callMenuProposal(input: LlmProposalInput): Promise<LlmProposalResult>`
  - `class LlmError extends Error`

- [ ] **Step 1: Check the SDK's structured-output signature against the installed version**

Do this before writing, and do not skip it. `generateObject` was removed in AI SDK 6 in favour of `generateText` with `Output.object()`, and the property the result is read from changed with it. Confirm against the package you just installed rather than against any example found online:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'
pnpm list ai
code node_modules/ai/dist/index.d.ts
```

Search that file for `Output` and for `experimental_output`. If the result property is still `experimental_output` in the installed version, use that name in Step 2 and leave a one-line comment saying which version required it. Everything else in this task is unaffected.

- [ ] **Step 2: Write the boundary**

```ts
import "server-only"

import { google } from "@ai-sdk/google"
import { generateText, Output } from "ai"

import { env } from "@/lib/env"
import {
  menuProposalSchema,
  type MenuProposal,
} from "@/lib/schemas/menu-proposal"

export type LlmProposalInput = {
  instructions: string
  request: string
  candidateCount: number
}

export type LlmProposalResult = {
  proposal: MenuProposal
  inputTokens: number
  outputTokens: number
}

/** The model was unreachable, too slow, or answered something unusable. */
export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "LlmError"
  }
}

const TIMEOUT_MS = 60_000

/**
 * Asks the model for a menu proposal.
 *
 * The single point in the application where an LLM SDK is imported, so the
 * provider stays replaceable — ESLint enforces that and design section 3
 * explains why the boundary, not the library, is what makes it reversible.
 *
 * The schema is built per call because it bounds the candidate index by the
 * number of candidates actually sent.
 *
 * @param input The instructions, the per-request data, and how many candidates
 * were numbered in it.
 * @returns The parsed proposal and what the call cost in tokens.
 * @throws LlmError When the call fails, times out, or the answer does not
 * satisfy the schema.
 */
export async function callMenuProposal(
  input: LlmProposalInput
): Promise<LlmProposalResult> {
  try {
    const result = await generateText({
      model: google(env.GEMINI_MODEL),
      system: input.instructions,
      prompt: input.request,
      output: Output.object({
        schema: menuProposalSchema(input.candidateCount),
      }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })

    return {
      proposal: result.output,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    }
  } catch (cause) {
    throw new LlmError("La generazione del menù non è riuscita.", { cause })
  }
}
```

- [ ] **Step 3: Verify the confinement rule actually bites**

Temporarily add `import { generateText } from "ai"` to the top of `lib/services/menus.ts`, then run:

Run: `pnpm lint`
Expected: FAIL, naming the rule from Task 1. **Remove the import again** and re-run to confirm PASS. A confinement rule nobody has seen fire is a rule nobody knows is wired up.

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/llm.ts
git commit -m "feat: the one file that may import an LLM SDK"
```

---

## Task 6: The orchestration

Gathering the candidates from the database, calling the boundary, mapping integers back to recipes, and refusing anything that breaks the one hard rule.

**Files:**

- Create: `lib/services/menu-proposal.ts`, `lib/services/menu-proposal.test.ts`

**Interfaces:**

- Consumes: `db` from `@/lib/db`; `buildCandidateLines`, `indexCandidates`, `type CandidateRecipe` from `./menu-candidates`; `callMenuProposal`, `LlmError` from `./llm`; `MENU_PROPOSAL_PROMPT`, `buildMenuProposalRequest` from `@/lib/prompts/menu-proposal`; `RECENCY_WINDOW_WEEKS`, `HOUSEHOLD_SERVINGS` from `@/lib/config`; `type MenuProposal` from `@/lib/schemas/menu-proposal`.
- Produces:
  - `type ProposedMenuSlot = { day: number; meal: "LUNCH" | "DINNER"; recipeId: string }`
  - `resolveProposal(proposal: MenuProposal, byNumber: Map<number, string>): ProposedMenuSlot[]`
  - `proposeMenu(weekStart: Date): Promise<ProposedMenuSlot[]>`
  - `class DuplicateProposalError extends Error`, `class NoCandidatesError extends Error`

- [ ] **Step 1: Write the failing test**

Only `resolveProposal` is tested. It holds the hard rule, and it is pure. `proposeMenu` is a database read plus a network call around it; per `docs/conventions/testing.md` that is not where the budget goes.

`lib/services/menu-proposal.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { DuplicateProposalError, resolveProposal } from "./menu-proposal"

const byNumber = new Map([
  [1, "recipe-one"],
  [2, "recipe-two"],
])

describe("resolveProposal", () => {
  it("maps a candidate number to its recipe id", () => {
    const slots = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 2 }] },
      byNumber
    )

    expect(slots).toEqual([{ day: 0, meal: "LUNCH", recipeId: "recipe-two" }])
  })

  it("drops an empty slot instead of inventing a recipe for it", () => {
    const slots = resolveProposal(
      {
        slots: [
          { day: 0, meal: "LUNCH", candidate: null },
          { day: 0, meal: "DINNER", candidate: 1 },
        ],
      },
      byNumber
    )

    expect(slots).toHaveLength(1)
    expect(slots[0].meal).toBe("DINNER")
  })

  it("throws when the same recipe is proposed twice in the week", () => {
    expect(() =>
      resolveProposal(
        {
          slots: [
            { day: 0, meal: "LUNCH", candidate: 1 },
            { day: 3, meal: "DINNER", candidate: 1 },
          ],
        },
        byNumber
      )
    ).toThrow(DuplicateProposalError)
  })

  it("allows the same recipe number in two different resolutions", () => {
    // Distinctness is a within-week rule, not a global one — design section 5.
    const first = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 1 }] },
      byNumber
    )
    const second = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 1 }] },
      byNumber
    )

    expect(first[0].recipeId).toBe(second[0].recipeId)
  })

  it("throws when a number has no candidate behind it", () => {
    expect(() =>
      resolveProposal(
        { slots: [{ day: 0, meal: "LUNCH", candidate: 9 }] },
        byNumber
      )
    ).toThrow()
  })

  it("returns nothing for a proposal with no filled slots", () => {
    expect(resolveProposal({ slots: [] }, byNumber)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test lib/services/menu-proposal.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the service**

```ts
import "server-only"

import { HOUSEHOLD_SERVINGS, RECENCY_WINDOW_WEEKS } from "@/lib/config"
import { db } from "@/lib/db"
import {
  buildMenuProposalRequest,
  MENU_PROPOSAL_PROMPT,
} from "@/lib/prompts/menu-proposal"
import type { MenuProposal } from "@/lib/schemas/menu-proposal"

import {
  buildCandidateLines,
  indexCandidates,
  type CandidateRecipe,
} from "./menu-candidates"
import { callMenuProposal, LlmError } from "./llm"

export type ProposedMenuSlot = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string
}

/** The model put the same recipe in the week twice. */
export class DuplicateProposalError extends Error {
  constructor() {
    super("Il menù proposto ripete una ricetta nella stessa settimana.")
    this.name = "DuplicateProposalError"
  }
}

/** There is nothing to choose from. */
export class NoCandidatesError extends Error {
  constructor() {
    super("Non ci sono ricette fra cui scegliere.")
    this.name = "NoCandidatesError"
  }
}

const MS_PER_DAY = 86_400_000

/**
 * Turns the model's integer answer into slots, refusing anything that breaks
 * the one rule the prompt is not trusted with.
 *
 * @param proposal The parsed response.
 * @param byNumber The number-to-id map the prompt was numbered against.
 * @returns One entry per filled slot; empty slots are dropped.
 * @throws DuplicateProposalError When a recipe appears more than once.
 */
export function resolveProposal(
  proposal: MenuProposal,
  byNumber: Map<number, string>
): ProposedMenuSlot[] {
  const slots: ProposedMenuSlot[] = []
  const used = new Set<string>()

  for (const slot of proposal.slots) {
    if (slot.candidate === null) continue

    const recipeId = byNumber.get(slot.candidate)
    if (recipeId === undefined) {
      throw new Error(`Candidate ${slot.candidate} is not in the index.`)
    }

    if (used.has(recipeId)) throw new DuplicateProposalError()
    used.add(recipeId)

    slots.push({ day: slot.day, meal: slot.meal, recipeId })
  }

  return slots
}

async function loadCandidates(weekStart: Date): Promise<CandidateRecipe[]> {
  const since = new Date(
    weekStart.getTime() - RECENCY_WINDOW_WEEKS * 7 * MS_PER_DAY
  )

  const [recipes, pastSlots] = await Promise.all([
    db.recipe.findMany({
      select: {
        id: true,
        title: true,
        totalMinutes: true,
        tags: true,
        ingredients: {
          select: { ingredientName: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { title: "asc" },
    }),
    db.menuSlot.findMany({
      where: {
        recipeId: { not: null },
        menu: { weekStart: { gte: since, lt: weekStart } },
      },
      select: {
        recipeId: true,
        day: true,
        menu: { select: { weekStart: true } },
      },
    }),
  ])

  // A slot that appeared in a past week counts as cooked — design section 6
  // takes that proxy knowingly. The day within the week is added back so two
  // recipes from the same week do not read as equally recent.
  const lastCooked = new Map<string, number>()
  for (const slot of pastSlots) {
    if (slot.recipeId === null) continue
    const cookedAt = slot.menu.weekStart.getTime() + slot.day * MS_PER_DAY
    const previous = lastCooked.get(slot.recipeId)
    if (previous === undefined || cookedAt > previous) {
      lastCooked.set(slot.recipeId, cookedAt)
    }
  }

  return recipes.map((recipe) => {
    const cookedAt = lastCooked.get(recipe.id)

    return {
      id: recipe.id,
      title: recipe.title,
      totalMinutes: recipe.totalMinutes,
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((row) => row.ingredientName),
      lastCookedDaysAgo:
        cookedAt === undefined
          ? null
          : Math.floor((weekStart.getTime() - cookedAt) / MS_PER_DAY),
    }
  })
}

/**
 * Proposes a week of meals for the given week.
 *
 * Writes nothing: the grid stays the source of truth and the proposal only
 * pre-fills it, per the parent design document section 6.2.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns One entry per proposed slot, empty slots omitted.
 * @throws NoCandidatesError When the recipe book is empty.
 * @throws LlmError When the model is unreachable or answers unusably.
 * @throws DuplicateProposalError When the answer repeats a recipe.
 */
export async function proposeMenu(
  weekStart: Date
): Promise<ProposedMenuSlot[]> {
  const candidates = await loadCandidates(weekStart)
  if (candidates.length === 0) throw new NoCandidatesError()

  const index = indexCandidates(candidates)
  const month = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    timeZone: "UTC",
  }).format(weekStart)

  const { proposal } = await callMenuProposal({
    instructions: MENU_PROPOSAL_PROMPT,
    request: buildMenuProposalRequest({
      candidates: buildCandidateLines(candidates),
      month,
      servings: HOUSEHOLD_SERVINGS,
      filled: "Tutti gli slot sono liberi.",
    }),
    candidateCount: index.count,
  })

  return resolveProposal(proposal, index.byNumber)
}

export { LlmError }
```

- [ ] **Step 4: Run the test again**

Expected: PASS, six tests.

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/services/menu-proposal.ts lib/services/menu-proposal.test.ts
git commit -m "feat: propose a week, and refuse one that repeats a dish"
```

---

## Task 7: The action and the button

**Files:**

- Modify: `app/(app)/menu/[weekStart]/actions.ts`, `app/(app)/menu/[weekStart]/page.tsx`
- Create: `components/menu/generate-button.tsx`

**Interfaces:**

- Consumes: `proposeMenu`, `NoCandidatesError`, `DuplicateProposalError`, `LlmError` from `@/lib/services/menu-proposal`; `setSlot` from `@/lib/services/menus`; `requireSession` from `@/lib/auth`.
- Produces: `generateWeek(weekStart: string): Promise<{ error: string } | void>`

- [ ] **Step 1: Read the two files you are about to change**

`app/(app)/menu/[weekStart]/actions.ts` already holds `saveSlot` and `emptySlot`. Match their shape exactly — the same validation order, the same `revalidatePath` call, the same error convention. Do not invent a second style beside the first.

- [ ] **Step 2: Write the action**

Append to `actions.ts`. The order is fixed by `CLAUDE.md`: validate, authenticate, authorise, mutate.

```ts
const WeekStartSchema = z.iso.date()

export async function generateWeek(weekStart: string) {
  const parsed = WeekStartSchema.safeParse(weekStart)
  if (!parsed.success) return { error: "Settimana non valida." }

  await requireSession()

  const monday = new Date(`${parsed.data}T00:00:00.000Z`)

  try {
    const slots = await proposeMenu(monday)

    for (const slot of slots) {
      await setSlot(monday, slot.day, slot.meal, {
        recipeId: slot.recipeId,
        freeText: null,
        servings: null,
      })
    }
  } catch (error) {
    if (error instanceof NoCandidatesError) {
      return { error: "Aggiungi qualche ricetta prima di generare un menù." }
    }
    if (error instanceof DuplicateProposalError) {
      return { error: "Il menù proposto ripeteva un piatto. Riprova." }
    }
    if (error instanceof LlmError) {
      return { error: "Non sono riuscito a generare il menù. Riprova." }
    }
    throw error
  }

  revalidatePath(`/menu/${parsed.data}`)
}
```

Note the deliberate narrowness: this writes into an empty week. Overwriting slots the user filled by hand is not in scope — the button is only offered when the week is empty, which Step 3 enforces.

- [ ] **Step 3: Check what `alert-dialog` actually exports**

`components/ui/alert-dialog.tsx` is already installed — **do not run `shadcn add`**. This installation is built on Base UI, so open the file and confirm the export names before writing against them. Step 4 assumes `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`. If a name differs, follow the file, not this plan.

While you are in there, find how dismissal is controlled. The waiting state below must **not** be dismissible: Escape or a click outside during a generation would leave the user staring at a grid that is about to change under them. If the component closes on Escape by default, pass whatever prop disables it.

- [ ] **Step 4: Write the button and its dialog**

`components/menu/generate-button.tsx`. A client component because it owns three states and a modal.

The dialog is the point of this task. A generation takes several seconds — long enough that a button which merely greys out reads as an app that has hung. The dialog says what is happening, and it is the same surface that reports the failure, so the user never has to wonder which of the two occurred.

```tsx
"use client"

import { useState, useTransition } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type Props = {
  weekStart: string
  action: (weekStart: string) => Promise<{ error: string } | void>
}

export function GenerateButton({ weekStart, action }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await action(weekStart)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <Button type="button" disabled={pending} onClick={generate}>
        Genera il menù
      </Button>

      {/* One dialog, two states. On success neither is true and it closes by
          itself, because the action has already revalidated the grid. */}
      <AlertDialog open={pending || error !== null}>
        <AlertDialogContent>
          {pending ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Sto preparando il menù…</AlertDialogTitle>
              <AlertDialogDescription>
                Sto scegliendo i piatti della settimana. Ci vuole qualche
                secondo.
              </AlertDialogDescription>
            </AlertDialogHeader>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Non ce l&apos;ho fatta</AlertDialogTitle>
                <AlertDialogDescription>{error}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setError(null)}>
                  Chiudi
                </AlertDialogCancel>
                <AlertDialogAction onClick={generate}>
                  Riprova
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

Two things this deliberately does **not** do. There is no cancel button while it is generating: the server action cannot be called back, so a cancel would only lie about what it stopped. And the waiting state has no footer at all, which is what makes it visibly not-dismissible rather than dismissible-but-please-do-not.

- [ ] **Step 5: Render it, but only on an empty week**

In `app/(app)/menu/[weekStart]/page.tsx`, render `GenerateButton` only when every slot of the week is empty. The page already has the slots in hand from `getMenuWeek`; the condition is that none of them carries a `recipeId` or a `freeText`. Pass `generateWeek` as the `action` prop.

- [ ] **Step 6: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 7: Run `web-design-guidelines` over the changed files**

`CLAUDE.md`: UI work is not done until this skill has been run over the changed files and its findings addressed or explicitly dismissed. The files are `components/menu/generate-button.tsx` and `app/(app)/menu/[weekStart]/page.tsx`.

Pay attention to what it says about the waiting state: a modal that appears without warning takes focus, and a screen reader user needs to be told what it is waiting for, not just that something opened.

- [ ] **Step 8: Manual browser check, at 390px**

No end-to-end tests in this project — a standing decision. Walk this by hand, or drive it through the `playwright` MCP server:

1. Open a week with no slots filled. The button is there.
2. Press it. **The dialog opens and says it is preparing the menu.** The button behind it is not reachable.
3. Press Escape, and click outside the dialog. **Neither dismisses it** while it is generating.
4. It closes by itself and the grid is filled. **No dish appears twice in the week** — this is the check that matters.
5. Open a slot and change the recipe. The edit sticks; the proposal was only a pre-fill.
6. Reload the week. The button is gone, because the week is no longer empty.
7. Break the key in `.env` (a character will do), restart `pnpm dev`, press the button on an empty week. **The dialog switches to the failure state**, in Italian, with "Chiudi" and "Riprova". The grid is untouched and building the week by hand still works. Press "Chiudi": the dialog goes and the page is usable. **Put the key back.**
8. With the key still broken, press "Riprova" instead: it returns to the waiting state and fails again, without stacking dialogs.
9. Empty the recipe book in a scratch database, or point at one with no recipes: the button is not offered.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/menu/[weekStart]/actions.ts" "app/(app)/menu/[weekStart]/page.tsx" components/menu/generate-button.tsx
git commit -m "feat: ask for a week, and say so while the answer is on its way"
```

---

## Task 8: The roadmap

A plan is not finished until its row moves.

**Files:**

- Modify: `docs/roadmap.md`

- [ ] **Step 1: Move the row**

Add a "Shipped" row for `2026-08-21-menu-generation` naming what it left behind: `lib/services/llm.ts`, `proposeMenu`, the numbered-candidate contract, and the generate button.

Then rewrite the "Not started" section:

- **Item 1, menu generation** — remove it. Note that slot-level and day-level regeneration were deliberately left out (spec §10), so nobody records them as debt.
- **Item 2, recipe import** — correct it. It says the import needs `lib/services/llm.ts` and is not started; the import shipped in #19 from JSON-LD alone, and the owner has excluded the LLM fallback. The roadmap is currently wrong about this, independently of this plan.
- **Add the next plan**: the LLM function registry and its owner-only screen, spec §7.

- [ ] **Step 2: Record the amendments where somebody will find them**

In `docs/roadmap.md`, under the standing decisions, one line: menu generation runs on Google Gemini through the AI SDK, and the design document of 2026-08-21 amends three decisions of the parent spec. Point at the file; do not restate it.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: menu generation ships, and the import row stops claiming it needs an LLM"
```

---

## Self-review notes

Checked against the spec after writing:

- §3 provider, library, model → Task 1 and Task 5.
- §4.1 what is sent → Task 3 and Task 4. Instructions excluded by the type.
- §4.2 integer indices → Task 2.
- §4.3 code-enforced distinctness → Task 6, `resolveProposal`.
- §5 criteria and their ranking → Task 4, the prompt.
- §6 recency, eight-week window, calendar-as-cooked → Task 6, `loadCandidates`.
- §8 failure handling → Task 7: the action maps each error to an Italian message, the dialog shows it with a way out, and checklist points 7 to 9 walk the failures in a browser.
- §9 testing → Tasks 2, 3, 6 test; Task 7 checks by hand.
- §7 registry → **deliberately not in this plan.** Next one.

**One retry is not implemented.** Spec §4.3 allows a single retry before surfacing a failure. It is not here: a retry that re-runs the same prompt against the same candidates mostly reproduces the same answer, and the error path is already non-destructive. Add it if duplicate proposals turn out to be common in use — that is data worth having before writing the code.
