# Menu Generation — Design Document

**Date:** 2026-08-21
**Status:** Design approved, pending implementation plan
**Scope:** the LLM half of the weekly menu, and the screen that configures it
**Parent:** [`2026-08-13-menu-spesa-design.md`](2026-08-13-menu-spesa-design.md).
This document **amends** three of its decisions — see §2. Where the two disagree,
this one governs for menu generation only.

---

## 1. Purpose

The fourteen-slot grid of the parent spec §6.2 exists and is editable by hand.
What is missing is the proposal: the owner opens a week, asks for a menu, and
gets fourteen slots pre-filled with recipes worth cooking.

Two things ship together, because the first is useless without the second:

1. `lib/services/llm.ts` and `proposeMenu` — the generation itself.
2. An owner-only screen that holds the prompt, the model and the execution
   history, so the prompt can be tuned without a deploy.

The second is not a nicety. Composing a menu is a judgement call over
conflicting criteria, and no prompt is right on the first attempt. A deploy per
word changed is the friction that stops the tuning from happening at all.

### Success criterion

A generated week is one the household would actually cook, and it takes fewer
edits by hand than composing the week from scratch. Measured by use, not by
assertion.

---

## 2. What this amends in the parent spec

Recorded here so nobody reconciles the two documents by silently picking one.

| Parent spec says                                                                                                                                               | This document decides                                                                                                  | Why                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §3, §7.2, §9.1 — **Anthropic Messages API**, `@anthropic-ai/sdk`, `claude-opus-5`, `ANTHROPIC_API_KEY`                                                         | **Google Gemini** through the Vercel AI SDK, `@ai-sdk/google`, `GOOGLE_GENERATIVE_AI_API_KEY`                          | The owner has a Google account and wants one API key with no service-account ceremony. §3 below records what makes this reversible.                                                                                                             |
| §7.2 — _"Prompts live as separate files, not inline string literals, so they can be edited and diffed independently"_                                          | Prompts live **in the database**, editable from the app                                                                | The reason for files was the git diff. §7 replaces it with the execution history, which pairs each prompt with the result it produced — strictly more informative than a diff. The **default** prompt still lives in a file, and seeds the row. |
| §6.2 — _"Cooldown is a configuration value, default 3 days. It filters candidates passed to the LLM; it is not a prompt instruction, so it cannot be ignored"_ | No candidate is filtered out. Recency becomes **data in the prompt**, and the only hard constraint is enforced in code | §5. The owner's requirement changed after using the grid: repetition across weeks is fine. A filter can express a ban, and a ban is no longer what is wanted.                                                                                   |

`DEFAULT_COOLDOWN_DAYS` in `lib/config.ts` is removed by this change. Its comment
states the very rationale being retired.

---

## 3. Provider, library and model

| Decision                                                                       | Rationale                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel AI SDK** (`ai`), not LangChain or an agent framework                  | The workload is one call. Measured: ~1,500 input tokens, ~200 output, once a week. LangGraph's model — stateful graphs, checkpoints, loops — buys nothing here and costs a mental model. The parent spec §3 reached the same conclusion against the Claude Agent SDK, for the same reason.            |
| **`@ai-sdk/google`**, reading `GOOGLE_GENERATIVE_AI_API_KEY`                   | One environment variable. `@ai-sdk/google-vertex` needs a service-account private key in an env var, and does not accept the Agent Platform express-mode API key at all (vercel/ai#10058).                                                                                                            |
| **`gemini-3.7-flash`**, in an environment variable                             | The most capable current Flash model. Not Pro: it is in preview, and an app nobody supervises does not rest on a preview model. Choosing fourteen dishes from thirty is judgement, not frontier reasoning — if Flash gets the menus wrong, the cause is the prompt, and a bigger model would hide it. |
| **Structured output via `generateText` + `Output.object()`** with a Zod schema | `generateObject` was removed in AI SDK 6. Zod 4 is already the project's contract layer, and `CLAUDE.md` already names LLM structured outputs as one of the three consumers of `lib/schemas/`.                                                                                                        |

**What makes the provider reversible** is not the SDK — it is the boundary that
already binds: every LLM call goes through `lib/services/llm.ts` and no other
file imports the SDK. Model names, thinking budgets, safety settings and error
shapes do not transfer between providers; the service absorbs them. Switching is
one file and one environment variable, and that is the property worth protecting.

**The ESLint rule that enforces this is written for Anthropic** and must be
re-pointed at `@ai-sdk/*`, or the constraint stops covering the provider actually
in use.

---

## 4. The generation call

### 4.1 What is sent

One call. No tools, no multi-step, nothing for the model to go and fetch.

| Part                                                                                           | Source                            | Approx. tokens      |
| ---------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- |
| Candidate lines: `12. Pollo all'aglio — 45min — carne, forno — pollo, aglio fresco, rosmarino` | `Recipe` + `RecipeIngredient`     | ~900 for 30 recipes |
| Recency: `used 9 days ago` on each line that has one                                           | `MenuSlot` of past weeks (§6)     | included above      |
| Context: month, `HOUSEHOLD_SERVINGS`, slots already filled and to be preserved                 | `lib/config.ts`, the current menu | ~50                 |
| The instructions                                                                               | the prompt row (§7)               | ~400                |

Recipe **instructions are never sent.** How a dish is cooked plays no part in
deciding whether to schedule it on Tuesday; it is most of the tokens for none of
the decision.

Ingredients **are** sent, because §5 makes fresh-ingredient reuse a criterion,
and it is the only criterion that cannot be judged without them.

At this size the context window is not a constraint and will not become one: a
thousand recipes would still be ~30,000 tokens against a 1M window. The limit
that arrives first is attention over a long list, and a household recipe book
does not reach it.

### 4.2 What comes back

**Integer indices, not ids.** Candidates are numbered `1..N` in the prompt and
the model returns integers, which are mapped back to recipe ids by the service.

This is not a token optimisation. It makes the output schema
`z.number().int().min(1).max(N)`, so a hallucinated recipe is **impossible to
express** rather than something to detect afterwards. `cuid` values invite
mangling and can only be validated after the fact.

A slot may also come back empty — the model is not forced to fill fourteen when
the candidates do not support it.

### 4.3 What the service enforces, not the prompt

Validated in code after parsing, before anything is written:

- **Every index is distinct.** No dish twice in one week. §5 makes this the
  strongest constraint in the design, and it is the one a prompt should never be
  trusted with.
- **Every index is within range**, which the schema already guarantees.
- **Slots the caller asked to preserve come back unchanged.**

A violation is one retry, then a failure surfaced to the user. No self-repair
loop: with the constraints above, a valid response is cheap to obtain and an
invalid one is a signal, not something to negotiate with.

---

## 5. The selection criteria

Four criteria, settled with the owner on 2026-08-21. They conflict by
construction — variety pushes apart, ingredient reuse pushes together — so the
prompt states an order rather than leaving the model to improvise one.

**Variety is a within-week constraint, not a global one.** This is the correction
that came out of using the grid: repeating a dish from one week to the next is
fine and expected. Repeating within the same week is not.

The structure is therefore two-tier, and the strong tier is not a prompt
instruction at all:

| Tier              | Rule                                                           | Enforced by                              |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------- |
| **Hard**          | No dish appears twice in the same week                         | Code — distinct indices (§4.3)           |
| **Soft, ranked**  | 1. fresh-ingredient reuse · 2. weekly balance · 3. seasonality | The prompt                               |
| **Soft, weakest** | Prefer dishes not cooked recently — a nudge, never a ban       | The prompt, using the recency data of §6 |

What each soft criterion means, for the default prompt:

- **Fresh-ingredient reuse** — prefer weeks where a perishable ingredient
  (parsley, cream, half a cabbage) is consumed by two dishes rather than one.
  Less waste, cheaper shopping.
- **Weekly balance** — fish, meat and vegetarian spread across the week; quick
  dishes on weekdays and longer ones at the weekend, using `totalMinutes`.
- **Seasonality** — prefer produce in season **in Italy** for the month given.
  The model knows this; the database does not. The month is all it needs.

Ranking reuse first is the owner's call and is the opposite of what was proposed.
It is worth stating the risk it accepts, because it is the first thing to revisit
if generated weeks disappoint: a model optimising for reuse will happily put the
same ingredient in half the week. The soft recency nudge is what holds against
it, and the balance criterion sits directly below.

---

## 6. Recency: what "recently cooked" means

Nothing in the schema records that a dish was cooked. Deriving it needs no
migration.

**A recipe that appeared in a past `MenuSlot` counts as cooked.** Settled with
the owner on 2026-08-21, knowingly: if the household ate out that evening, the
dish still counts. For a soft preference this is more than accurate enough, and
the alternative is a "cooked?" checkbox that decays into stale data — the same
failure the parent spec §2 rejects pantry tracking for.

The query reads `MenuSlot` rows of menus whose `weekStart` precedes the current
week, takes the most recent occurrence per `recipeId`, and expresses it as whole
days. Recipes never scheduled carry no recency marker.

**The window is eight weeks.** Beyond that, "cooked four months ago" and "never
cooked" carry the same information, and the distinction only costs tokens. A
recipe outside the window is treated as never scheduled.

---

## 7. The LLM function registry

### 7.1 What it is

Every LLM-backed feature is a row keyed by a stable string id. Today there is
exactly one, `menu-proposal`. The registry exists anyway, because the screen that
justifies it — prompt tuning against real results — is what makes the feature
improvable.

The row holds: the id, a human-readable name and description, the prompt text,
the model name, `temperature`, `maxOutputTokens`, and its executions.

**What is not in the registry:**

- **Domain parameters.** They dissolved. The order of the criteria, what recency
  means, how the criteria are described — all of it is prompt text, and the
  prompt is already editable. There is no second mechanism, and no key-value
  table. Should a genuinely numeric per-function parameter ever appear, the
  answer is a `Json` column validated by an id-specific Zod schema: one
  migration, no new table.
- **The output schema.** It is code, it is coupled to what the service does with
  the result, and a prompt edit must not be able to break it. The screen
  **displays** it, read-only, beside the prompt.

### 7.2 Defaults and fallback

The default prompt lives in a file and seeds the row. If the row is missing, the
service falls back to the file rather than failing — an empty table must not take
the feature down. This is the same principle as the parent spec §8: no LLM path
may become a dead end.

### 7.3 Execution history

Every call writes one execution row: the prompt actually used, the model,
input and output token counts, duration, the raw output, and the error if it
failed.

**The prompt stored per execution is the version history.** A week that came out
well is an execution carrying the prompt that produced it — going back is copying
from there. Unlike a table of prompt versions, every version arrives attached to
the result it achieved, which is the only thing that says whether it was better.

**Twenty executions are kept per function**, oldest deleted on write. Settled
with the owner on 2026-08-21. One generation a week is nothing against Neon's
0.5 GB, but a bounded table needs no future decision about what to discard.

### 7.4 The screen

Owner-only, and reachable from the side menu only for the owner.

```
/impostazioni/llm                 list of functions
  └─ /impostazioni/llm/[id]       prompt, model, parameters, read-only schema
       └─ …/esecuzioni            the last twenty
            └─ …/esecuzioni/[id]  one execution in full
```

Four levels, the same shape as `/spesa`, built from the existing primitives in
`components/page/`. Nothing new is invented in the UI.

**Authorisation.** `lib/env.ts` already carries `OWNER_EMAIL` — no `role` column
and no migration. The session email is compared against it **inside every server
action**, per `CLAUDE.md`: validate, authenticate, authorise, mutate.

This screen deserves the care. Whoever reaches it rewrites the LLM's
instructions — persistent prompt injection, through a door the app opened itself.
With two trusted users the risk is low, which is a reason to get the guard right
once, not a reason to skip it.

---

## 8. Failure handling

Extends the parent spec §8; its governing principle is unchanged — **every
LLM-assisted path has a working manual equivalent, and the app stays fully usable
with the API down.**

| Failure                                               | Behaviour                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API unreachable, times out, or returns an error       | The grid stays exactly as it is, with a retry affordance. Building the week by hand is untouched.          |
| Response fails schema validation, or repeats an index | One retry, then an explicit error. Never a partially applied menu.                                         |
| Prompt row missing                                    | Fall back to the default prompt file (§7.2).                                                               |
| No candidate recipes                                  | The generate action is not offered. An empty recipe book is not an error state to report from an LLM call. |
| Execution row fails to write                          | The menu is still returned. History is diagnostics; losing a row must not lose a generation.               |

A generation **writes the slots it proposes, and is only offered on a week where
every slot is empty.** The parent spec §6.2 makes the grid the source of truth
and the LLM a convenience over it; that property is preserved by the emptiness
precondition rather than by withholding the write. There is nothing to
overwrite, and every slot stays editable afterwards exactly as if it had been
typed by hand.

The alternative — holding fourteen proposed slots in client state until a
separate save — buys no safety and costs a second source of truth for the grid.

---

## 9. Testing

Per `docs/conventions/testing.md`. LLM output quality is not asserted; it is
evaluated by use.

**Tested:**

- Candidate assembly — the numbered lines, the recency values, the bounded
  window, recipes with no history.
- The response contract — the Zod schema, out-of-range and duplicate indices,
  empty slots, mapping indices back to recipe ids.
- History retention — the twenty-row bound holds, oldest goes first.
- The prompt-row fallback when the row is absent.

**Not tested:** the SDK, the model, prompt wording, React components.

The one manual check that matters: generate a week, and confirm the same dish
never appears twice in it.

---

## 10. Out of scope

- **Recipe import via LLM.** Excluded on the owner's call, 2026-08-21. The
  import shipped in #19 and works from JSON-LD alone. `structureRecipe`,
  `parseIngredientLines` and `guessAisles` — the other three functions of the
  parent spec §7.1 — are not built. `lib/services/llm.ts` exposes `proposeMenu`
  and nothing else.
- **Regenerating a single slot or a single day.** The parent spec §6.2 lists
  them. The week is the unit that ships first; a slot-level call is the same
  call with a different candidate set and one slot of output, and it costs
  nothing to add later.
- **Streaming.** A once-a-week call that takes a few seconds behind a pending
  state needs no token-by-token UI.
- **Cost controls.** ~1,500 input tokens once a week. There is nothing to
  optimise, and a budget guard would be more code than the thing it guards.
