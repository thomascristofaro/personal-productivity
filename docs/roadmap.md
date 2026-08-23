# Roadmap

Where the build actually is, and what comes next. This file records **sequence
and state** — nothing else does. The design authority stays
`docs/superpowers/specs/2026-08-13-menu-spesa-design.md`, and the decisions live
in `docs/conventions/`. Do not restate either here; point at them.

Last updated: 2026-08-23. `main` is deployed. The finance module is in flight on
`feat/finance-foundation` — see below. Work normally happens on a branch per
plan; that branch is the stated exception and says why.

## Shipped

| Plan                                                                                                                                                                                     | What it left behind                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`2026-08-13-data-model-and-domain-core`](superpowers/plans/2026-08-13-data-model-and-domain-core.md)                                                                                    | the Prisma schema, `lib/week.ts`, `lib/aisles.ts`, `lib/config.ts`, the Italian ingredient parser, and **the shopping-list aggregator** — pure, and the most heavily tested thing in the repo                                                                                                                                                                                                                                       |
| [`2026-08-14-recipes`](superpowers/plans/2026-08-14-recipes.md)                                                                                                                          | `lib/services/recipes.ts` and the four recipe screens: list, detail, create, edit                                                                                                                                                                                                                                                                                                                                                   |
| [`2026-08-14-app-shell-and-page-primitives`](superpowers/plans/2026-08-14-app-shell-and-page-primitives.md)                                                                              | the side menu, `components/page/`, the four designed states, back links, `RedirectType.replace`                                                                                                                                                                                                                                                                                                                                     |
| [`2026-08-14-ingredient-catalogue`](superpowers/plans/2026-08-14-ingredient-catalogue.md)                                                                                                | the `Ingredient` table keyed on its name, a 93-entry seed, ingredient rows in the recipe form, tags as chips, the aggregator re-keyed                                                                                                                                                                                                                                                                                               |
| [`2026-08-14-ingredient-management`](superpowers/plans/2026-08-14-ingredient-management.md)                                                                                              | the `/ingredients` screens, `IngredientInputSchema`, the catalogue reads and writes, and the second module proving `components/page/` transfers                                                                                                                                                                                                                                                                                     |
| [`2026-08-14-weekly-menu`](superpowers/plans/2026-08-14-weekly-menu.md)                                                                                                                  | `/menu/[weekStart]`, the fourteen-slot grid, the slot drawer and `lib/services/menus.ts` — all by hand, no LLM                                                                                                                                                                                                                                                                                                                      |
| [`2026-08-14-shopping-list`](superpowers/plans/2026-08-14-shopping-list.md)                                                                                                              | `/spesa/[weekStart]`, the aisle-grouped list, optimistic ticking, manual items, and the freshness signal over `Menu.slotsUpdatedAt`                                                                                                                                                                                                                                                                                                 |
| [`2026-08-15-authentication`](superpowers/plans/2026-08-15-authentication.md)                                                                                                            | Google sign-in through `better-auth`, `lib/auth/`, the session gate in `middleware.ts`, `/login` and "Esci", and the four `better-auth` tables                                                                                                                                                                                                                                                                                      |
| [`2026-08-18-catalogue`](superpowers/plans/2026-08-18-catalogue.md)                                                                                                                      | `Ingredient` renamed `CatalogItem` with a `kind`, `/catalogo` and its three chips, and names lowercased in `lib/schemas/catalog.ts`                                                                                                                                                                                                                                                                                                 |
| [`2026-08-18-shopping-list-again`](superpowers/plans/2026-08-18-shopping-list-again.md)                                                                                                  | `days` on a line, `lib/services/shopping-view.ts` and its merge, the `+` drawer, and free items landing in the catalogue                                                                                                                                                                                                                                                                                                            |
| [`2026-08-18-shopping-done`](superpowers/plans/2026-08-18-shopping-done.md)                                                                                                              | `Purchase` and `PurchaseItem`, the bar at the till, `/spesa/storico`, `lib/money.ts`, and the aggregator subtracting what has already been bought                                                                                                                                                                                                                                                                                   |
| [`2026-08-20-page-primitives`](superpowers/plans/2026-08-20-page-primitives.md), design in [`2026-08-20-page-primitives-design`](superpowers/specs/2026-08-20-page-primitives-design.md) | one form contract instead of six — `lib/form.ts`, `useFormState`, four typed fields and `FormField` — `FormDrawer` replacing four hand-rolled close-on-success effects, one page shell instead of thirteen `<main>`s, `ListSection`, `SearchField`, `FilterChips`, and `MessagePage` for the three "does not exist" screens. Two things a user sees: «Svuota» is gone from the slot drawer, and `/catalogo` gained its search field |
| [`2026-08-21-menu-generation`](superpowers/plans/2026-08-21-menu-generation.md), design in [`2026-08-21-menu-generation-design`](superpowers/specs/2026-08-21-menu-generation-design.md) | the LLM half of the menu: `lib/services/llm.ts` — the only file that may import an SDK — `proposeMenu`, candidates as numbered lines the model answers with integers, recency derived from past `MenuSlot` rows, and a waiting dialog that turns into the failure. Runs on **Google Gemini**, not Anthropic                                                                                                                         |
| [`2026-08-21-llm-registry`](superpowers/plans/2026-08-21-llm-registry.md)                                                                                                                | `LlmFunction` and `LlmExecution`, `requireOwner()` over `OWNER_EMAIL`, the prompt moving into the database with `lib/prompts/menu-proposal.ts` as the fallback, and the four owner-only screens under `/settings/llm`. The prompt file is the default and the row is the tuning — **editing the file changes nothing once the row exists**                                                                                          |

## In flight

**The finance module, on `feat/finance-foundation`.** One branch carrying three
plans, because each builds on the one before and squash merges make a stack of
three painful. Design:
[`2026-08-23-finance-design`](superpowers/specs/2026-08-23-finance-design.md).

| Plan                                                                                        | What it leaves behind                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`2026-08-23-module-fork`](superpowers/plans/2026-08-23-module-fork.md)                     | `lib/modules.ts` — a module is one entry in one list — and `/` moving inside `(app)` to become a fork. With one visible module it redirects, so nothing changed on screen until the second arrived                                                                                                                                                          |
| [`2026-08-23-finance-core`](superpowers/plans/2026-08-23-finance-core.md)                   | `FinanceAccount`, `Movement`, `ImportBatch`, `visibleAccountIds`, the three readers, the import with its preview and its **duplicate counting**, and the accounts, movements and import screens                                                                                                                                                            |
| [`2026-08-23-finance-meaning`](superpowers/plans/2026-08-23-finance-meaning.md)             | `Category`, `CategoryRule`, `TransferLink`, the three sieves, the one-tap rule with its backfill, the pairing and its confirmation, and the summary with the three-month comparison                                                                                                                                                                        |

**Two readers are built on a guess.** Intesa Sanpaolo's and Satispay's column
names have never been checked against a real export — both files say so at the
top. Revolut's is the documented layout. A file whose header does not match is
refused with the columns it wanted printed beside the columns it found, so the
first real export diagnoses itself. **Do not treat those two as working until a
real file has gone through them.**

**Deploying it needs nothing by hand.** Three migrations, the last of which
inserts the thirteen starting categories — data in a migration and not in
`prisma/seed.ts`, because the module cannot work without one of them: confirming
a transfer assigns the category whose kind is `TRANSFER`, and with none present
`transferCategoryId()` throws rather than writing a movement into the one bucket
the totals ignore.

**Do not move that list back into the seed**, and do not wire `pnpm db:seed`
into the build to solve a problem like this again. The seed also upserts the
users on their email — see the warning under item 3 below — and re-inserts the
108 catalogue rows, which is what resurrected nineteen ingredients and four
recipes once already. It is a development convenience, not a deploy step.

**A component refactor went in with it, and touches the menu module too.**
`FormMessage` painted every message in the error colour, so `/settings/llm` had
been confirming a save in red since it shipped. It now takes the tone from
`state.ok`. Alongside: `DetailSection` and `CardList` extracted from
`ListSection` and `DataList`, a new `DataRow`, `DataListRow` with an optional
`href`, and `Alert` added from shadcn.

Nothing else. The recipe import merged on 2026-08-21 (#19) — `share_target` points at
a `/import` that exists, `lib/json-ld.ts` reads the broken JSON real sites
publish, `lib/url-guard.ts` refuses the addresses a fetcher must not reach, and a
save creates the catalogue entries the recipe names instead of refusing over
them. No component was added to `components/`.

**Deliberately without the LLM.** §6.1 of the menu design has JSON-LD first and
an LLM fallback for pages without it; only the first half shipped. Whether the
fallback earns its cost is a question about real pages, and now there is a way to
find out. Deferred with it: the LLM fallback for ingredient lines the Italian
parser cannot read, and `guessAisles`.

**Next up:** the finance module or the news reader — the first real test of
whether the page primitives carry to a section that is not menu-and-shopping.

**Merged on 2026-08-22:**

**The functions were running in Washington and the database in Frankfurt.** Found
by asking why production felt slow. Vercel's default region is `iad1`; Neon is in
`eu-central-1`. Every interaction crossed the Atlantic — and not once: a save is
the session lookup, the mutation, then the re-render of the revalidated page with
its own session lookup and reads. Six to eight round trips, mostly sequential. At
a millisecond each, invisible; at a hundred, the second the owner was waiting.
**Fixed by hand in the Vercel dashboard, on the owner's call — there is no
`vercel.json` in this repository, so nothing in the code records it.** If the
database ever moves, the function region has to be moved with it, from the
dashboard.

**Three fixes from real use** (#23). Cancelling the overwrite prompt showed an
error panel and left it up: the dialog content was a ternary chain whose last
branch was the error, and because the content is keyed, Base UI read the
simultaneous key change as a remount rather than a close. **The LLM function was
invisible in production**: the settings screen listed rows, and only the seed
creates them — which production never runs, by the decision in `data.md` that no
local environment may reach it. `lib/llm-functions.ts` is now the register and
the row is created by the first save. Also two owner screens that borrowed the
shell's title, and «Genera il menù» taking `variant="outline"` at the owner's
request.

**English route segments** (#21). `catalogo`, `impostazioni`, `spesa`,
`spesa/storico` and `esecuzioni` became `catalog`, `settings`, `shopping`,
`shopping/history` and `runs`, with `?tipo=` becoming `?kind=`. The app is
installed as a PWA, so nobody reads the address bar; the folder tree is read
every day. The rule is now in `CLAUDE.md`, where its absence was what let two
conventions coexist.

**Merged on 2026-08-20**, all three:

- **The page primitives** (#16) and their polish
  ([plan](superpowers/plans/2026-08-20-page-primitives-polish.md)) — the row in
  the table above says what they left behind.
- **`ui.md` rewritten as a manual** (#17), plus `countLabel` replacing five
  copies of one count sentence.
- **`PageForm`** — the page twin of `FormDrawer`, so a form component is a hook
  call and a list of fields. `PageHeader` gained the `subtitle` four pages were
  each spelling out. The remount key became one rule with one reason.
- The two tidy-ups from `feat/readable-type`: the `prodotto` badge dropped from
  the catalogue list, and `middleware.ts` renamed `proxy.ts` for Next 16.

**The type scale stays Tailwind's.** The app reads small on a phone — content at
14px, details at 12px — and two theme-wide fixes were built and tried at 390px:
raising `text-xs`/`text-sm` by two pixels, and raising the root to 18px. **Both
rejected on 2026-08-19**, the owner's call: a scale whose names stop matching
their values costs more later than the forty class names it saves. Sizes will be
raised per element instead, at the call sites, when each screen calls for it.
What was learnt on the way is in [`docs/conventions/ui.md`](conventions/ui.md) —
chiefly that no `Button` size raises its text, so `className="text-base"` is the
lever.

**Shipped, and merged on 2026-08-19:**

**The development database moved off production** (`chore/local-postgres`):
`docker-compose.yml`, the `.env` pointing at it, and `prisma migrate deploy`
folded into `pnpm build`. Production's data was copied into the container once —
32 recipes, 11 menus, the catalogue — with `Session`, `Account` and
`Verification` truncated on arrival. See
[`docs/conventions/data.md`](conventions/data.md).

**Two decisions the shopper makes on the line**, on the branch
`feat/partial-and-already-home`. No plan document: a bounded change to screens
that already exist, designed in chat and argued in
[§17 of the design document](superpowers/specs/2026-08-18-catalogue-and-purchases-design.md).
A pencil on each row records how much is actually going in the trolley, and the
bin now takes the whole line — deleting a hand-added row, and moving a generated
one to **Tolte dalla lista** at the foot of the page. Migration
`20260819083852_shopping_item_taken_and_dismissed`. The catalogue's `prodotto`
badge lost its colour in the same branch.

**Shipped before it, and merged:** the catalogue, the shopping list and the
purchase history, from the branch `docs/catalog-and-purchases-design` —
[`2026-08-18-catalogue-and-purchases-design`](superpowers/specs/2026-08-18-catalogue-and-purchases-design.md)
and its three plans, squash-merged into `main` on 2026-08-18.

**All three landed on one branch, against the usual rule.** The owner's call on
2026-08-18: merging a branch that holds only a design document and three plans
buys nothing, so the pull request waited until there were changes worth
reviewing. Each plan still left the app working and `pnpm verify` green, so the
branch was mergeable at every task boundary.

Plan B's browser checklist settled the one open question from the original
report. **The quantity that "did not appear" was typed into the Unità field**:
both rows the owners added by hand carry `unit: "2"` and `quantity: null`. The
line then renders no amount, because `amountOf` needs a quantity, and it will
not merge with the same thing bought properly, because the units differ. Not a
code defect — but the form made it easy, so `UnitSchema` now refuses a unit that
is only a number and says where the quantity goes. **Their two existing rows are
still wrong in the database**; they are the owners' data and were left alone.

Plan B also found that Base UI's combobox leaves its popup open after the custom
«Crea «…»» button is clicked — Base UI closes on its own items, and that button
is ours. It covered the two fields below it, so the first tap on Quantità went
to the overlay. `IngredientPicker` now controls its open state. The recipe form
uses the same picker and gets the fix with it.

Plan C's checklist found one more, now fixed: **the nav marked two entries as
the current page.** `/shopping/history` sits under `/shopping`, and the prefix test lit
both, so `aria-current="page"` stopped meaning "this page". It now picks the
longest matching href.

Two things plan A found that its own plan had not foreseen, both now fixed:

- **The lowercasing needed a backfill.** The design asserted the catalogue was
  already all lowercase. Two entries added from the app since — `Cocomero` and
  `Olive verdi` — were not, which is exactly the defect being fixed. Migration
  `20260818112000_normalise_catalog_names` corrects `CatalogItem.name`, which
  cascades into `RecipeIngredient`, and `ShoppingListItem.name`, which is a
  copied string and cascades from nothing.
- **Base UI's `Select.Value` renders the raw value.** The Tipo field read
  `INGREDIENT` on screen until the root was given an `items` map. The aisle
  select never showed this because there the value and the label are the same
  string — so any future select whose values differ from its labels needs
  `items`.

Before this branch: **the product loop was closed** — plan a week, generate the
list, shop from it, and all three screens driven end to end. **Authentication
shipped on 2026-08-15**, so what is left after this branch is the LLM half and
deployment.

### What authentication left unverified

The Google client is real, the credentials are in `.env`, and the two seeded
users now carry the owners' actual Gmail addresses — renamed in place, ids
untouched, because `ShoppingListItem.checkedBy` points at them.

Of the Task 6 checklist, points 1, 6 and 7 pass. Point 6 is worth naming: a
`POST` carrying a real `Next-Action` id from the build manifest, with no session
cookie, answers **307 to `/login`** — the action never runs.

**Points 2 to 5 were never executed**, on the owner's call: completing a Google
sign-in needs a human at the keyboard, and point 3 needs a third Google account
that was not to hand. Point 3 is the one that matters — _an unseeded account is
refused and creates no `User` row_ — and it rests entirely on `disableSignUp:
true`, argued for but never observed. Run it the first time a third Google
account is available, before anyone treats the deployment as private.

**The checklist debt is paid.** On 2026-08-15 all three manual browser
checklists were executed at 390px through the `playwright` MCP server:
ingredient management (8 points), the weekly menu (10) and the shopping list
(11). Every point passed. The stale dev server was the only thing wrong with
`/spesa` — restarting `pnpm dev` picked up the post-migration Prisma client and
the route has rendered correctly ever since, so `Menu.slotsUpdatedAt` and
`ShoppingList.generatedAt` are confirmed working against a real browser.

Eight defects surfaced along the way and **all eight were then fixed**, on the
owner's call, in the commit after the checklists: the stale `picked` left behind
by "Svuota", the recipe field that reopened empty, the note lost on a refused
slot save, the add-item form that never reset, the English 404, the missing
`aria-current`, the units that were never pluralised, and the Base UI
`useControlled` warnings. Each was re-checked in the browser afterwards.

Two things came out of that worth knowing:

- `lib/units.ts` is new — the regular Italian plural applied to a free-text
  unit. It is the only reason "5 spicchi" reads correctly, and it is pure and
  tested, so extend it there rather than at a call site.
- `hooks/use-attempt.ts` is new. The forms feed `state.values` into
  `defaultValue` to survive React 19's reset; that changes a `defaultValue`
  after mount, which is what Base UI was warning about. Keying the fields on an
  attempt counter remounts them instead. Any new form using that echo pattern
  wants the same hook.

A second pass then cleared the **pre-existing** parked defects too, so the list
below is down to two entries, both of them decisions rather than debt. That pass
added `env(safe-area-inset-*)` and the `viewportFit: "cover"` without which the
insets always report zero, `touch-action: manipulation`, the missing
`autoComplete`s, an Italian message on `sourceUrl`'s `.max()`, and an
unsaved-changes guard on the recipe form via `hooks/use-unsaved-changes.ts`.

The number field that silently reverted on an implicit Enter turned out to be
the same root cause as the Base UI warnings — a `defaultValue` mutating on a
live input — and the `useAttempt` remount had already fixed it. Confirmed by
A/B: with the key removed the field empties again, with it the value survives.

The seed data the checklists needed was left in place, on the owner's call:
three recipes (`Spaghetti aglio e olio`, `Pollo all'aglio`,
`Bruschette all'aglio`), a populated menu for the week of 2026-08-10, and its
shopping list. The catalogue is at 92 entries — `birra` was deleted and `aglio`
renamed to `aglio fresco` with its aisle moved to `dispensa`, all three as
checklist steps. **Re-running the seed would leave `aglio` sitting next to
`aglio fresco`**, so reset the database rather than reseeding over it.

**None of it is in the database any more.** The history import below was rerun
with `--reset` on the owner's call, which emptied the recipes, the ingredients
and the menus first. The paragraph above is kept because it explains rows that
existed for two days, not rows anybody will meet again.

### The Keep history was imported on 2026-08-17

The owners kept their weekly menus in a Google Keep note before this app
existed. Ten weeks of it are now in the database: **31 recipes and 131 slots**
across 2026-06-01 to 2026-08-10, the week of 03/08 skipped because they were
away. The most cooked dish appears seven times, which is the point — nothing
recorded when a recipe was last cooked, and now the `MenuSlot` rows carry enough
history for the cooldown of §6.2 to be derived rather than waited for.

The catalogue went from 92 to 108 entries and stopped being generic Italian
cookbook: the owners cook cold summer salads, so `cetrioli`, `feta`, `valeriana`,
`farro`, `cous cous`, `fiocchi di latte`, `straccetti veggie` and the rest went
in, and the herbs they never buy came out.

**The data files are git-ignored** — `/prisma/import`, and the folder holds the
transcription, `run.ts` and `verify.ts`. This repository is public, and ten weeks
of menus say which evenings two named people were away from home. `run.ts` is
idempotent and validates everything before writing; `verify.ts` reads the result
back through `getMenuWeek`.

**The database now holds exactly what those files say and nothing else.** Neither
the seed nor an ordinary import deletes anything, so rows dropped from the source
files survive — nineteen ingredients and four recipes did, until `--reset` took
them. `verify.ts` lists any that appear again.

`--reset` is a flag and not the default on purpose: a recipe added from the app
later is real work, and rerunning the import must not be what destroys it. Use it
only when the files are meant to be the whole truth.

### The shell changed on 2026-08-16

Three things, on the owner's call, none of them planned in a document:

- **Theme**: preset `b3RYqbJZY` — style `maia`, base colour `olive`, theme
  `lime` — applied over `mira`/`mist`/`teal`. It rewrote all 19 components in
  `components/ui/`, which cost nothing because they were stock.
- **Navigation**: one full-screen menu at every width, `components/app-nav.tsx`.
  The desktop rail, `components/ui/sidebar.tsx` and `hooks/use-mobile.ts` are
  gone. The bar carries the hamburger, the word "Menu" and a theme toggle; the
  keyboard shortcut that used to switch theme went with it.
- **PWA**: manifest and icons, above.

## Not started

In dependency order. Each needs its own plan; none has one yet.

### 1. Regenerating one slot or one day — spec §6.2

**Deliberately left out** of menu generation, not forgotten. The week is the
unit that shipped; a slot-level call is the same call with a different candidate
set and one slot of output. Do not record it as debt.

### 2. Recipe import — nothing left that needs an LLM

The import **shipped in #19** and works from JSON-LD alone. The owner excluded
the LLM fallback on 2026-08-21: it works well enough as it is, so
`structureRecipe`, `parseIngredientLines` and `guessAisles` are not built and
`lib/services/llm.ts` exposes `proposeMenu` only.

`lib/services/ingredient-parse.ts` and `lib/services/ingredient-name.ts` are
still called by the import, so the note that once protected them from being
deleted as dead code no longer applies.

### 3. PWA and deployment — spec §9, §10

**The manifest shipped on 2026-08-16**, with `app/manifest.ts` and icons drawn by
`ImageResponse` in `app/icons/[icon]/route.tsx`. What is left here is the
`share_target`, held back deliberately: it points at `/import`, so it goes in
with the import module rather than putting the app in Android's share sheet to
land on a 404.

**Not verified on a real phone yet.** Install from the home screen, check the
icon and the splash, and check that the safe-area insets still hold once the
browser chrome is gone.

**`main` is deployed.** It went to Vercel on 2026-08-16, authentication included,
with the six auth variables set at Production scope. Preview deployments are
switched off — Build and Deployment → "Only build production" — because a
preview URL is generated per deployment and Google only accepts redirect URIs
registered by hand, so sign-in could never work there.

**The Google client may still only know about localhost.** Until the production
origin is added to the OAuth client as an authorised JavaScript origin _and_ as
the redirect URI `https://<domain>/api/auth/callback/google`, the site builds and
serves but the sign-in is rejected at the callback. `APP_URL` must be that same
origin, without a trailing slash.

**Do not reseed on the production database to change the addresses.** The seed
upserts on email, so it adds users rather than renaming them. Update the rows in
place — their ids are referenced by `ShoppingListItem.checkedBy`.

**A seeded user needs `emailVerified = true` or it can never sign in.** Found on
2026-08-16, on the first real Google sign-in: better-auth refuses to link a first
OAuth account to a local user whose email is unverified
(`accountLinking.requireLocalEmailVerified`, default true), and the refusal
reaches `/login?negato=1`, where the page reads "Questo account Google non è
abilitato." The message points at `disableSignUp`, which is not what happened —
the account _is_ allowed, the link is what was refused. The seed now sets the
flag; rows created before it need a one-off `UPDATE`.

### 4. Continuous integration on pull requests

Outside the dependency chain above — it blocks nothing and nothing blocks it.

**The workflow is written**: `.github/workflows/verify.yml`, on 2026-08-17. It
runs `pnpm verify` on Ubuntu with pnpm 11 and Node 24 — the dev machine is on
Node 26, so a version-specific failure would show up here first.

**It is not armed.** Its only trigger is `workflow_dispatch`: it never starts by
itself, and can only be launched by hand from the Actions tab. Arming it means
uncommenting the `pull_request` trigger in that file and nothing else — the
placeholder `DIRECT_URL` it needs is in the job, not in a secret, because
`prisma generate` resolves the variable but opens no connection.

Until it is armed, this is what nothing covers, and it is why the file exists at
all — the git hooks went on 2026-08-17 (see the standing decision below):

| Check    | Who runs it now                                                                |
| -------- | ------------------------------------------------------------------------------ |
| `tsc`    | Vercel — `next build` type-checks by default, so a type error fails the deploy |
| `eslint` | **nobody** — Next 16 removed linting from `next build`                         |
| `vitest` | **nobody**                                                                     |

ESLint is the gap that matters: it is the only thing enforcing the layering ban,
the `actorId` rule, the confinement of the Anthropic SDK and the TSDoc
requirement. Those are decisions from `CLAUDE.md`, and nothing else checks them.

**Arming it is the owner's call, and they have not made it** — one developer, a
private app, and `pnpm verify` run by hand covers it for now. Do not arm it while
tidying something else.

## Standing decisions taken in conversation

Only the ones that live nowhere else. Everything else was written into the spec
or `docs/conventions/` as it was decided.

- **One working branch — until 2026-08-15.** `feat/app-shell` carried every plan
  from the data model to the shopping list. From authentication onward it is one
  branch per plan, cut from `main` and merged back into it.
- **Squash merges, so branches are single-use.** Every PR lands on `main` as one
  commit, which means `main` holds a branch's content but none of its commits.
  Reusing a branch after its PR is merged asks git to reconcile the same work
  against a squash that already contains it, and every file touched since comes
  back as a conflict — this cost a morning on 2026-08-16. **Delete the branch
  when the PR merges and cut the next one from `main`.**
- **No end-to-end browser tests.** Playwright was proposed twice and declined
  both times. Every plan therefore ends its UI tasks with a written, ordered
  manual checklist rather than a test file. Keep writing them that way — the
  decision stands, and nothing Playwright-shaped belongs in `package.json` or in
  the test run.
  Since 2026-08-14 those checklists no longer have to be walked by hand: an
  agent can drive a browser through the `playwright` MCP server, registered
  outside the repo at user scope. It is a way of _running_ the checklist, not a
  reason to stop writing one.
- **No git hooks — 2026-08-17.** `simple-git-hooks` and `lint-staged` are gone,
  along with the `pre-commit` (`lint-staged`) and `pre-push` (`pnpm verify`)
  hooks. The owner does not want checks firing on their own at commit time: they
  are run by hand during development, and by CI on pull requests once item 4
  above exists. Do not reintroduce a hook to close that gap — it is the same
  automatic-at-commit behaviour that was rejected.
- **The LLM is Google Gemini, not Anthropic — 2026-08-21.** Through the Vercel
  AI SDK, on the **Cloud Agent Platform** and not AI Studio: the key in
  `GOOGLE_AI_API_KEY` is refused by `generativelanguage.googleapis.com` with
  `API_KEY_SERVICE_BLOCKED`, so `GOOGLE_AI_BASE_URL` points at
  `aiplatform.googleapis.com` and `llm.ts` hands both to the provider — the
  variable is also deliberately **not** the `GOOGLE_GENERATIVE_AI_API_KEY` the
  SDK would look for by itself. `pwsh scripts/llm-probe.ps1` says which host a
  key can actually reach, and the two failures look identical from the app. The
  design of
  [`2026-08-21`](superpowers/specs/2026-08-21-menu-generation-design.md) §2
  amends three decisions of the parent spec — provider, prompts leaving the
  filesystem, and the cooldown ceasing to be a filter. Read that table before
  reconciling the two documents.
- **A new required environment variable has to be added in three places.**
  `lib/env.ts`, `vitest.config.ts` — which declares a fake environment inline
  rather than reading `.env` — and the fixture in `lib/env.test.ts`. Miss either
  of the last two and the suite fails on an absence that exists only in the test
  harness.
- **Frontend choices get surfaced, not decided silently.** The owner is a backend
  developer and asked for React and UI patterns to come from the skills in
  `.agents/skills/` rather than from memory, and for any debatable frontend call
  to be raised explicitly.
- **Duplicate shopping rows are merged in the read path, not in the database —
  2026-08-18.** `mergeLines` in `lib/services/shopping-view.ts` unites rows with
  the same name and unit when the list is rendered. The rows stay apart in
  Postgres on purpose: a regeneration deletes the generated rows and rebuilds
  them, and a hand-added quantity has to survive that. This is the owner's own
  proposal and it is better than the extra column the design first reached for.
  **Do not "fix" it by summing on the way in.**
- **What has been bought is subtracted, not forgotten — 2026-08-18.**
  `aggregateShoppingList` takes a **required** `purchased` input. Making it
  optional would let a caller silently regenerate as if nothing had ever been
  bought, which is the exact defect the rule exists to prevent.
- **A Base UI `Select` whose values differ from its labels needs `items` —
  2026-08-18.** `Select.Value` renders the raw value otherwise, and the Tipo
  field read `INGREDIENT` on screen until the map was passed. The aisle select
  never showed this because there the value and the label are the same string,
  so the next one will be caught the same way: only in the browser.
- **What the menu needs and what the shopper buys are two numbers —
  2026-08-19.** `ShoppingListItem.takenQuantity` holds the second; `quantity`
  stays the menu's. Editing `quantity` from the row would look simpler and would
  be undone by the first regeneration, silently. Same reasoning as the merge
  above: keep the shopper's answer where the recomputation cannot reach it.
- **A generated row cannot be deleted, only dismissed — 2026-08-19.** The bin
  deletes a hand-added row and flags a generated one `dismissed`, because
  deleting the latter lasts until the next regeneration rebuilds it. Dismissed
  lines show under «Tolte dalla lista» with one tap back.
- **Development never touches production — 2026-08-19.** Postgres 18 in Docker
  on port 5433, and the Neon credentials removed from the local `.env`. The
  owner called it after watching a `DELETE` run against production to clean up a
  browser check. `pnpm build` therefore runs `prisma migrate deploy`: with no
  direct connection on any laptop, the deploy is the only thing left that can
  migrate production, and it must not be something anyone has to remember.

## Parked defects

Real, small, and none of them blocking. Fold each into whichever plan next
touches that file rather than making a plan for them.

The list was cleared on 2026-08-15, before starting authentication. What is left
is here because it was **decided**, not because nobody got to it — do not
"fix" either without saying so first.

| Defect                                                                                                                                                                                                                                                                                                                                                           | Where                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `notFound()` renders the right page but answers **200**, because the layout shell has already streamed by the time it throws. Affects `/menu/[weekStart]` and `/ingredients/[name]/edit` alike; a genuinely unrouted path still answers 404. **Accepted**: the app is private and nothing crawls it, and the alternative is giving up the streamed loading state | `app/(app)/**`               |
| No unsaved-changes warning on the **ingredient** form or the slot drawer. **Deliberate**: three short fields and a drawer, and a drawer that argues when dismissed is worse than the loss. The recipe form has one                                                                                                                                               | ingredient form, slot drawer |
| A purchase cannot be deleted or undone. Closing a shop by mistake is recoverable only through the database. **Deliberate**: not requested, and an undo has to decide what to do when the list has been regenerated since. Add it the first time it actually happens                                                                                              | `lib/services/purchases.ts`  |
| Two shopping rows carry the quantity in the **unit** field — `pesche` and `cocomero`, both `unit: "1"` or `"2"` with `quantity: null`. They render no amount and will not merge. `UnitSchema` now refuses this on the way in, but these two predate it and are **the owners' data**, so they were left alone. Fix them from the app when convenient              | `ShoppingListItem`           |

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
