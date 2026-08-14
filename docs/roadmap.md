# Roadmap

Where the build actually is, and what comes next. This file records **sequence
and state** — nothing else does. The design authority stays
`docs/superpowers/specs/2026-08-13-menu-spesa-design.md`, and the decisions live
in `docs/conventions/`. Do not restate either here; point at them.

Last updated: 2026-08-15. Work happens on one branch, `feat/app-shell`.

## Shipped

| Plan                                                                                                        | What it left behind                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`2026-08-13-data-model-and-domain-core`](superpowers/plans/2026-08-13-data-model-and-domain-core.md)       | the Prisma schema, `lib/week.ts`, `lib/aisles.ts`, `lib/config.ts`, the Italian ingredient parser, and **the shopping-list aggregator** — pure, and the most heavily tested thing in the repo |
| [`2026-08-14-recipes`](superpowers/plans/2026-08-14-recipes.md)                                             | `lib/services/recipes.ts` and the four recipe screens: list, detail, create, edit                                                                                                             |
| [`2026-08-14-app-shell-and-page-primitives`](superpowers/plans/2026-08-14-app-shell-and-page-primitives.md) | the side menu, `components/page/`, the four designed states, back links, `RedirectType.replace`                                                                                               |
| [`2026-08-14-ingredient-catalogue`](superpowers/plans/2026-08-14-ingredient-catalogue.md)                   | the `Ingredient` table keyed on its name, a 93-entry seed, ingredient rows in the recipe form, tags as chips, the aggregator re-keyed                                                         |
| [`2026-08-14-ingredient-management`](superpowers/plans/2026-08-14-ingredient-management.md)                 | the `/ingredients` screens, `IngredientInputSchema`, the catalogue reads and writes, and the second module proving `components/page/` transfers                                               |
| [`2026-08-14-weekly-menu`](superpowers/plans/2026-08-14-weekly-menu.md)                                     | `/menu/[weekStart]`, the fourteen-slot grid, the slot drawer and `lib/services/menus.ts` — all by hand, no LLM                                                                                |
| [`2026-08-14-shopping-list`](superpowers/plans/2026-08-14-shopping-list.md)                                 | `/spesa/[weekStart]`, the aisle-grouped list, optimistic ticking, manual items, and the freshness signal over `Menu.slotsUpdatedAt`                                                           |

## In flight

Nothing. **The product loop is closed**: plan a week, generate the list, shop
from it, and all three screens have now been driven end to end. What is left is
the LLM half, authentication and deployment.

**The checklist debt is paid.** On 2026-08-15 all three manual browser
checklists were executed at 390px through the `playwright` MCP server:
ingredient management (8 points), the weekly menu (10) and the shopping list
(11). Every point passed. The stale dev server was the only thing wrong with
`/spesa` — restarting `pnpm dev` picked up the post-migration Prisma client and
the route has rendered correctly ever since, so `Menu.slotsUpdatedAt` and
`ShoppingList.generatedAt` are confirmed working against a real browser.

Nine defects surfaced along the way. None blocks anything and none was fixed
inline; they are in **Parked defects** below. The two worth knowing about before
touching the menu drawer are the stale `picked` after "Svuota" and the recipe
field that reopens empty — both are in `components/menu/`.

The seed data the checklists needed was left in place: three recipes
(`Spaghetti aglio e olio`, `Pollo all'aglio`, `Bruschette all'aglio`), a
populated menu for the week of 2026-08-10, and its shopping list. The catalogue
is at 92 entries — `birra` was deleted and `aglio` renamed to `aglio fresco`
with its aisle moved to `dispensa`, all three as checklist steps.

## Not started

In dependency order. Each needs its own plan; none has one yet.

### 1. Menu generation — spec §6.2, §7

The grid exists and is editable by hand. What is missing is the LLM half:
`lib/services/llm.ts` — **it does not exist yet**, and `CLAUDE.md` binds every
Anthropic call to go through it — plus `proposeMenu` and regenerating one slot,
a day or the week.

One design question has no answer yet, and it is not an oversight to patch
quietly: **nothing in the schema records when a recipe was cooked**, so the
cooldown of §6.2 has to derive "recently cooked" from the `MenuSlot` rows of
past weeks. Settle that before writing the plan.

### 2. Recipe import from a URL — spec §6.1

JSON-LD extractor, LLM fallback, then matching the parsed lines against the
catalogue. This is why `lib/services/ingredient-parse.ts` and
`lib/services/ingredient-name.ts` are still in the repo with no caller — see the
note in the spec's §5 design notes before deleting them as dead code.

Also needs `lib/services/llm.ts`, and `app/manifest.ts` for the Android share
target, which does not exist either.

### 3. Authentication — spec §6.4

**This blocks going live.** `lib/auth.ts` throws `UnauthenticatedError` whenever
`NODE_ENV === "production"`, deliberately, so nothing can serve a real request
unauthenticated. Locally it resolves the first seeded user, which is why the app
works in `pnpm dev`.

The owner wanted to evaluate Better Auth before committing to an approach. That
evaluation has not happened.

### 4. PWA and deployment — spec §9, §10

No `app/manifest.ts`, so no home-screen install and no share target. Never
deployed to Vercel. Gated on §3 above.

## Standing decisions taken in conversation

Only the ones that live nowhere else. Everything else was written into the spec
or `docs/conventions/` as it was decided.

- **One working branch.** `feat/app-shell` carries every plan since the data
  model. Do not spawn a branch per plan.
- **No end-to-end browser tests.** Playwright was proposed twice and declined
  both times. Every plan therefore ends its UI tasks with a written, ordered
  manual checklist rather than a test file. Keep writing them that way — the
  decision stands, and nothing Playwright-shaped belongs in `package.json` or in
  the test run.
  Since 2026-08-14 those checklists no longer have to be walked by hand: an
  agent can drive a browser through the `playwright` MCP server, registered
  outside the repo at user scope. It is a way of _running_ the checklist, not a
  reason to stop writing one.
- **Frontend choices get surfaced, not decided silently.** The owner is a backend
  developer and asked for React and UI patterns to come from the skills in
  `.agents/skills/` rather than from memory, and for any debatable frontend call
  to be raised explicitly.

## Parked defects

Real, small, and none of them blocking. Fold each into whichever plan next
touches that file rather than making a plan for them.

| Defect                                                                                                                                                                                                                                      | Where                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A focused `type="number"` input silently reverts on implicit Enter submit                                                                                                                                                                   | `components/recipes/recipe-form.tsx`    |
| Dev-only Base UI `useControlled` warnings                                                                                                                                                                                                   | recipe **and ingredient** forms         |
| "Svuota" empties the slot but leaves the drawer open holding the old `picked`, so a note typed straight afterwards is refused with "una ricetta oppure una nota". Closing and reopening the drawer clears it                                | `components/menu/slot-drawer.tsx`       |
| Reopening a slot that holds a recipe shows the Ricetta field **empty**: `inputValue` is driven by a `query` state that starts at `""`, so the label of the held value never renders. The recipe is still attached and still saves           | `components/menu/recipe-picker.tsx`     |
| A refused slot save loses the note the user typed — the drawer does not echo submitted values back the way `ingredient-form.tsx` does                                                                                                       | `components/menu/slot-drawer.tsx`       |
| The add-item form does not reset after a successful add: the name stays in the combobox and the aisle keeps the previous pick, so the next item's text concatenates onto the old one                                                        | `components/shopping/add-item-form.tsx` |
| Only `recipes/[id]` has a `not-found.tsx`. `/menu/[weekStart]`, `/spesa/[weekStart]` and `/ingredients/[name]/edit` fall through to Next's built-in 404 — **in English**, against the Italian-for-users rule                                | `app/(app)/**`                          |
| The active sidebar entry carries only `data-active`, never `aria-current`, so the highlight is visual only                                                                                                                                  | `components/app-sidebar.tsx`            |
| Units are never pluralised: "3 spicchio aglio fresco" on a recipe, "5 spicchio" on the list                                                                                                                                                 | recipe detail, shopping list            |
| `sourceUrl`'s `.max()` still carries the English Zod default message                                                                                                                                                                        | `lib/schemas/recipe.ts`                 |
| No `touch-action: manipulation`, so a phone has the double-tap zoom delay                                                                                                                                                                   | `app/globals.css`                       |
| `notFound()` renders the right page but answers **200**, because the layout shell has already streamed by the time it throws. Affects `/menu/[weekStart]` and `/ingredients/[name]/edit` alike; a genuinely unrouted path still answers 404 | `app/(app)/**`                          |
| No `env(safe-area-inset-*)`, so the sticky header will sit under a notch once installed as a PWA                                                                                                                                            | `app/(app)/layout.tsx`                  |
| No `autoComplete` on the recipe form's flat fields, so password managers offer to fill "Nome"                                                                                                                                               | `components/recipes/recipe-form.tsx`    |
| No warning when leaving a form with unsaved changes — the back links made this easier to hit. **A product decision, not a bug to fix unasked.**                                                                                             | recipe and ingredient forms             |
| `components/ui/drawer.tsx` is installed and unused                                                                                                                                                                                          | —                                       |

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
