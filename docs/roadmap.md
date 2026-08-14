# Roadmap

Where the build actually is, and what comes next. This file records **sequence
and state** — nothing else does. The design authority stays
`docs/superpowers/specs/2026-08-13-menu-spesa-design.md`, and the decisions live
in `docs/conventions/`. Do not restate either here; point at them.

Last updated: 2026-08-14. Work happens on one branch, `feat/app-shell`.

## Shipped

| Plan                                                                                                        | What it left behind                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`2026-08-13-data-model-and-domain-core`](superpowers/plans/2026-08-13-data-model-and-domain-core.md)       | the Prisma schema, `lib/week.ts`, `lib/aisles.ts`, `lib/config.ts`, the Italian ingredient parser, and **the shopping-list aggregator** — pure, and the most heavily tested thing in the repo |
| [`2026-08-14-recipes`](superpowers/plans/2026-08-14-recipes.md)                                             | `lib/services/recipes.ts` and the four recipe screens: list, detail, create, edit                                                                                                             |
| [`2026-08-14-app-shell-and-page-primitives`](superpowers/plans/2026-08-14-app-shell-and-page-primitives.md) | the side menu, `components/page/`, the four designed states, back links, `RedirectType.replace`                                                                                               |
| [`2026-08-14-ingredient-catalogue`](superpowers/plans/2026-08-14-ingredient-catalogue.md)                   | the `Ingredient` table keyed on its name, a 93-entry seed, ingredient rows in the recipe form, tags as chips, the aggregator re-keyed                                                         |

## In flight

[`2026-08-14-ingredient-management`](superpowers/plans/2026-08-14-ingredient-management.md)
— the `/ingredients` screens, so a preferred unit or an aisle can be corrected
without opening `pnpm db:studio`. Check the plan's checkboxes and `git log`
for how far it got.

## Not started

In dependency order. Each needs its own plan; none has one yet.

### 1. Weekly menu — spec §6.2

The 7×2 grid, editable by hand, with LLM-assisted generation and a cooldown
window over recently cooked recipes. Nothing exists. The product loop is unusable
without it, and the shopping list has nothing to aggregate until it lands.

Needs `lib/services/llm.ts` first — **it does not exist yet**, and `CLAUDE.md`
binds every Anthropic call to go through it. Spec §7 describes what it owes.

### 2. Shopping list — spec §6.3

`aggregateShoppingList` is written, pure and covered by 17 tests. What is missing
is everything around it: the screen, the shared tick state between the two users,
and persistence into `ShoppingList` / `ShoppingListItem`. Depends on the menu.

### 3. Recipe import from a URL — spec §6.1

JSON-LD extractor, LLM fallback, then matching the parsed lines against the
catalogue. This is why `lib/services/ingredient-parse.ts` and
`lib/services/ingredient-name.ts` are still in the repo with no caller — see the
note in the spec's §5 design notes before deleting them as dead code.

Also needs `lib/services/llm.ts`, and `app/manifest.ts` for the Android share
target, which does not exist either.

### 4. Authentication — spec §6.4

**This blocks going live.** `lib/auth.ts` throws `UnauthenticatedError` whenever
`NODE_ENV === "production"`, deliberately, so nothing can serve a real request
unauthenticated. Locally it resolves the first seeded user, which is why the app
works in `pnpm dev`.

The owner wanted to evaluate Better Auth before committing to an approach. That
evaluation has not happened.

### 5. PWA and deployment — spec §9, §10

No `app/manifest.ts`, so no home-screen install and no share target. Never
deployed to Vercel. Gated on §4 above.

## Standing decisions taken in conversation

Only the ones that live nowhere else. Everything else was written into the spec
or `docs/conventions/` as it was decided.

- **One working branch.** `feat/app-shell` carries every plan since the data
  model. Do not spawn a branch per plan.
- **No end-to-end browser tests.** Playwright was proposed twice and declined
  both times: the owner checks the visual and interaction behaviour by hand.
  Every plan therefore ends its UI tasks with a written, ordered manual checklist
  rather than a test file. Keep writing them that way.
- **Frontend choices get surfaced, not decided silently.** The owner is a backend
  developer and asked for React and UI patterns to come from the skills in
  `.agents/skills/` rather than from memory, and for any debatable frontend call
  to be raised explicitly.

## Parked defects

Real, small, and none of them blocking. Fold each into whichever plan next
touches that file rather than making a plan for them.

| Defect                                                                                                                                          | Where                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A focused `type="number"` input silently reverts on implicit Enter submit                                                                       | `components/recipes/recipe-form.tsx` |
| Dev-only Base UI `useControlled` warnings                                                                                                       | recipe form                          |
| `sourceUrl`'s `.max()` still carries the English Zod default message                                                                            | `lib/schemas/recipe.ts`              |
| No `touch-action: manipulation`, so a phone has the double-tap zoom delay                                                                       | `app/globals.css`                    |
| No `overscroll-behavior: contain` on sheets and drawers                                                                                         | `app/globals.css`                    |
| No `env(safe-area-inset-*)`, so the sticky header will sit under a notch once installed as a PWA                                                | `app/(app)/layout.tsx`               |
| No `autoComplete` on the recipe form's flat fields, so password managers offer to fill "Nome"                                                   | `components/recipes/recipe-form.tsx` |
| No warning when leaving a form with unsaved changes — the back links made this easier to hit. **A product decision, not a bug to fix unasked.** | recipe and ingredient forms          |
| `components/ui/drawer.tsx` is installed and unused                                                                                              | —                                    |

## Starting a fresh session

`CLAUDE.md` loads automatically and points here. To pick up:

> Leggi `docs/roadmap.md`, poi la spec e le convenzioni. Facciamo il piano di
> `<modulo>`.

Then follow the usual process: `superpowers:brainstorming` if the shape is still
open, `superpowers:writing-plans` to write it, and
`superpowers:subagent-driven-development` or `superpowers:executing-plans` to run
it.

Two things worth checking before planning anything, because they are easy to
assume and expensive to get wrong:

- `git log --oneline main..HEAD` — what actually landed.
- `pnpm verify` — the gate must be green before you build on top of it.

**Keep this file current.** A plan is not finished until its row moves from "Not
started" to "Shipped".
