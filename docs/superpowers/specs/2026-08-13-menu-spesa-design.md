# Weekly Menu & Shopping List — Design Document

**Date:** 2026-08-13
**Status:** Design approved, pending implementation plan
**Scope:** v1 of a personal productivity app, first module
**Revision:** 2026-08-13 — hosting moved from self-hosted Docker + Cloudflare Tunnel
to Vercel Hobby + Neon free. Sections 3, 4.1, 9.1, 9.3, 10 and 11 revised. The
application design (4.2 onward) is unchanged.

---

## 1. Purpose

A self-hosted web app for two users (owner + partner) that removes the recurring
weekly cost of planning meals and writing a shopping list.

The concrete problems being solved:

- Composing a weekly menu from scratch every week
- Remembering which recipes exist and which were cooked recently
- Manually deriving a shopping list from the chosen meals
- Capturing recipes found online before they are forgotten

This is the **first module** of a larger personal app. Two further modules are
planned but explicitly out of scope: personal finance (bank statement ingest and
charts) and a filtered news reader. They share no data with this module — only
the shell, the database instance, and the deployment.

### Success criteria

The module succeeds if, after one month:

1. The weekly menu is composed in the app rather than verbally or on paper.
2. The shopping list is generated, not written by hand.
3. The partner uses it independently from her phone, without assistance.

Criterion 3 is the hardest and the one the design optimises for. The main failure
mode of self-built productivity tools is not construction — it is abandonment
caused by friction or stale data.

---

## 2. Non-goals (v1)

Deliberately excluded, to be reconsidered after real usage:

| Excluded                      | Reason                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Voice-driven recipe creation  | High value, but not required to ship. Bootstrap solves the cold-start problem instead.                |
| Recipe extraction from photos | Requires `POST` share target with multipart and OCR/vision. v2.                                       |
| Offline shopping list         | Only matters if poor supermarket signal proves to be a real problem. Solvable later without redesign. |
| Pantry / stock tracking       | Adds a maintenance burden that reliably decays into stale data.                                       |
| Nutrition, calories, macros   | Not a stated need.                                                                                    |
| Multi-user beyond two         | No requirement.                                                                                       |
| Native mobile app             | A PWA installed as a WebAPK is indistinguishable in use.                                              |
| Finance and news modules      | Separate modules, separate specs.                                                                     |

---

## 3. Decisions and rationale

Decisions already settled during design, recorded so they are not relitigated.

| Decision                                                      | Rationale                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js (App Router), single codebase**                     | Routing, bundling, API layer and shared types in one project. Separation of concerns is enforced by folder discipline, not by process boundaries.                                                                                                                                                                                                                                                                     |
| **No Capacitor; PWA installed as WebAPK**                     | No mobile build, no signing, no reinstall on update. Chrome on Android produces a real installable app from a valid manifest.                                                                                                                                                                                                                                                                                         |
| **Vercel Hobby for hosting, not a self-hosted host**          | Success criterion 3 is threatened most by silent downtime, and the likeliest cause on an always-on Windows PC is an unattended Windows Update reboot. Managed hosting removes that failure class entirely, along with Docker, the tunnel and the nameserver migration. CDN, TLS and the Node.js runtime are included and require no configuration. Hobby is restricted to non-commercial personal use, which this is. |
| **Neon free for Postgres, used as Postgres and nothing else** | Serverless Postgres with scale-to-zero and automatic wake. Unlike the alternative considered (Supabase), a Neon project is never paused for inactivity, so it can never require a manual click before the partner can use the app. No Neon-specific feature is used — no auth, no storage, no realtime — so the database stays portable behind Prisma.                                                                |
| **Custom domain via CNAME, no nameserver migration**          | Vercel needs only a `CNAME` record added at the existing registrar. The `cristofaro.dev` nameservers stay where they are and the GitHub Pages records are never touched.                                                                                                                                                                                                                                              |
| **shadcn/ui as the only component library**                   | Complete, accessible, owned source. Removes all base-component decisions from the critical path. (This project's shadcn install is built on Base UI rather than Radix — an implementation detail of the generated components, with no effect on the rule.)                                                                                                                                                            |
| **Anthropic Messages API, not the Claude Agent SDK**          | The workload is single structured calls, not autonomous multi-step agent work. The Agent SDK adds a shell, filesystem and OAuth-token lifecycle for no benefit here. A container-resident OAuth profile expires silently and breaks the app unattended; an API key does not.                                                                                                                                          |
| **Recipe bootstrap performed with Claude Code, not the app**  | Loading the first ~30 recipes is a one-off interactive task. Doing it on the host with the existing Claude Code subscription costs nothing and requires no feature. The app therefore ships with a populated recipe book.                                                                                                                                                                                             |
| **JSON-LD parsing before any LLM call on import**             | Most recipe sites publish `schema.org/Recipe` structured data. Deterministic parsing is free, instant and exact. The LLM is a fallback, not the default path.                                                                                                                                                                                                                                                         |
| **Shopping list contains no LLM logic**                       | Aggregating ingredients from selected recipes is ordinary code. An LLM here would add cost, latency and non-determinism to a solved problem.                                                                                                                                                                                                                                                                          |

---

## 4. Architecture

### 4.1 Deployment topology

Two managed services, no owned infrastructure.

```
        https://personal-productivity.cristofaro.dev
                          │
              ┌───────────▼────────────┐
              │  Vercel (Hobby)        │
              │  Edge Network = CDN    │
              │  Next.js app           │
              │  route handlers, RSC,  │
              │  server actions        │
              │  = Vercel Functions    │
              └───────────┬────────────┘
                          │ pooled connection
              ┌───────────▼────────────┐
              │  Neon (free)           │
              │  Postgres, serverless  │
              │  scale-to-zero, auto   │
              │  wake                  │
              └────────────────────────┘
```

- **Vercel** serves static assets and images from its CDN with no configuration,
  terminates TLS on the custom domain, and runs every route handler, server
  component and server action as a Node.js Vercel Function. There is no separate
  server process, no container and no image to build.
- **Neon** is the database and nothing more. The compute scales to zero after
  five minutes of inactivity and wakes automatically on the next query; the first
  request after an idle period pays a sub-second wake-up.

Two services, nothing else. No third component runs anywhere.

Single origin. No CORS. Session cookies work without special configuration.

**Relevant free-tier ceilings** (verified 2026-08-13; re-check before relying on
them). Vercel Hobby: 300 s maximum function duration, 1M invocations, 4 CPU-hours
of active compute, 100 GB transfer, cron jobs limited to once per day with ±59
minutes of scheduling jitter. Neon free: 0.5 GB storage, 100 CU-hours per month,
6 hours of instant-restore history plus one manual snapshot. The expected
workload — two users, one menu per week, a shopping list polled while open — sits
far below every one of these.

The 300 s function ceiling is what makes the menu generation of §6.2 safe as a
single synchronous call. Should a future model make that call slower, generating
per day rather than per week is the fallback, and it requires no redesign.

**Connection handling.** Serverless functions must use Neon's pooled connection
string; Prisma migrations must use the direct one. Both are configured in
`schema.prisma` via `url` and `directUrl`.

### 4.2 Application structure

```
app/
  (app)/…                    pages; "use client" only where interactivity requires it
  api/…/route.ts             HTTP handlers — parsing, auth, response shaping only
  manifest.ts                web app manifest, including share_target
components/
  ui/                        shadcn/ui components (generated, owned, editable)
  …                          feature components composed from components/ui
lib/
  services/                  DOMAIN LAYER — the logical "backend"
    recipes.ts
    menu.ts
    shopping.ts
    import.ts
    llm.ts                   the single boundary to the Anthropic API
  schemas/                   Zod schemas — the shared contract
  db.ts                      Prisma client singleton
  auth.ts
prisma/
  schema.prisma
```

**Boundary rule (binding).** `lib/services/` must not import from `app/` or
`components/`, must not reference React, and must not reference `Request` or
`Response`. Services take typed arguments and return typed values. Route handlers
and server components are thin callers.

This gives the logical separation requested, while keeping types shared for free
within a single TypeScript project.

### 4.3 UI component rule (binding)

**All base UI components come from shadcn/ui.** No alternative component library
is to be introduced, and no base component is to be hand-written.

- The project is already initialised (`components.json`, style `base-mira`, base
  colour `mist`). Do not re-run `init` and do not change the theme configuration.
- Add components individually with `pnpm dlx shadcn@latest add <component>`. Sources
  land in `components/ui/` and are owned by the project — edit them in place when
  a change is needed rather than wrapping them.
- When a required component does not exist in shadcn/ui, **compose it from
  existing shadcn primitives** inside `components/`. Do not reach for another
  library.

Expected component set for v1: `button`, `input`, `textarea`, `card`, `dialog`,
`drawer`, `sheet`, `checkbox`, `select`, `command`, `form`, `label`, `tabs`,
`badge`, `separator`, `skeleton`, `sonner`, `alert-dialog`.

Mobile notes: prefer `drawer` (bottom sheet) over `dialog` on small viewports;
verify touch targets meet ~44px; the app is phone-first, desktop-tolerable.

---

## 5. Data model

Prisma sketch. Field-level detail will be finalised during implementation; the
shape and the relationships are the design commitment.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
}

model Recipe {
  id            String             @id @default(cuid())
  title         String
  sourceUrl     String?
  servings      Int?
  totalMinutes  Int?
  instructions  String?            // markdown
  notes         String?
  tags          String[]           // "pesce", "veloce", "vegetariano"
  ingredients   RecipeIngredient[]
  slots         MenuSlot[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}

model RecipeIngredient {
  id         String  @id @default(cuid())
  recipeId   String
  recipe     Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  raw        String  // "320 g di spaghetti" — always preserved
  name       String  // "spaghetti" — normalised, used for aggregation
  quantity   Float?
  unit       String? // "g", "ml", "pz", "cucchiai"; null = "to taste"
  position   Int
}

// Learned mapping: ingredient name -> supermarket aisle.
// Populated once per ingredient, reused thereafter. Same pattern the finance
// module will use for transaction categorisation.
model IngredientAisle {
  name  String @id   // normalised ingredient name
  aisle String       // "ortofrutta", "banco frigo", "dispensa", …
}

model Menu {
  id        String     @id @default(cuid())
  weekStart DateTime   @unique   // Monday, at 00:00 local
  slots     MenuSlot[]
  list      ShoppingList?
  createdAt DateTime   @default(now())
}

model MenuSlot {
  id       String   @id @default(cuid())
  menuId   String
  menu     Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  day      Int      // 0 = Monday … 6 = Sunday
  meal     MealType // LUNCH | DINNER
  recipeId String?
  recipe   Recipe?  @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  freeText String?  // "fuori a cena", "avanzi" — excluded from the shopping list

  @@unique([menuId, day, meal])
}

enum MealType { LUNCH DINNER }

model ShoppingList {
  id        String             @id @default(cuid())
  menuId    String             @unique
  menu      Menu               @relation(fields: [menuId], references: [id], onDelete: Cascade)
  items     ShoppingListItem[]
  createdAt DateTime           @default(now())
}

model ShoppingListItem {
  id          String   @id @default(cuid())
  listId      String
  list        ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  name        String
  quantity    Float?
  unit        String?
  aisle       String
  checked     Boolean  @default(false)
  checkedById String?
  checkedAt   DateTime?
  manual      Boolean  @default(false)  // added by hand, survives regeneration
}
```

### Design notes on the model

**`MenuSlot` is a three-state cell**: a recipe reference, free text, or empty.
This is what makes the menu grid fully editable rather than a list of proposals.
A `freeText` slot never contributes to the shopping list.

**`RecipeIngredient.raw` is always preserved** alongside the parsed fields. If
parsing is wrong, the original string is still there for the user to correct, and
nothing is lost.

**`IngredientAisle` is learned, not configured.** The first time an ingredient
appears, its aisle is guessed (dictionary first, LLM as fallback) and confirmed
by the user; from then on it is free and instant.

**`ShoppingListItem.manual`** exists so that regenerating a list after editing
the menu does not delete items added by hand ("sacchetti", "detersivo").

---

## 6. Key flows

### 6.1 Recipe import via Android share sheet

The primary capture path. Declared in the web app manifest:

```jsonc
"share_target": {
  "action": "/import",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

Once the PWA is installed, the app appears in Android's share sheet. Sharing a
link from Chrome, Instagram or WhatsApp opens the app directly on the import
confirmation screen.

**Known pitfall — handle it from the start.** Android's share intent places the
shared link in `EXTRA_TEXT`, so Chrome typically delivers the URL in the **`text`**
parameter, not `url`. The handler must read `url` first and, when empty, extract
the first URL from `text` with a regex. Assuming `url` is populated is the single
most common cause of a share target that silently does nothing.

Pipeline:

```
shared URL
   │
   ├─▶ 1. server fetches the page (SSRF guard — see §9.3)
   │
   ├─▶ 2. parse <script type="application/ld+json"> for @type: "Recipe"
   │        found ──▶ deterministic mapping ──▶ draft recipe   (no LLM, no cost)
   │        absent ─▶ 3
   │
   ├─▶ 3. extract readable text, send to LLM with a structured output schema
   │
   ├─▶ 4. parse each ingredient string into {quantity, unit, name}
   │        deterministic Italian-pattern parser first, LLM fallback per unparsed line
   │
   └─▶ 5. CONFIRMATION SCREEN — always shown, never skipped
            user reviews/corrects title, servings, ingredients, aisles → Save
```

Step 5 is non-negotiable. Wrong quantities propagate into the shopping list, and
a shopping list that lies is worse than no shopping list.

A manual paste-a-URL field offers the same pipeline for desktop use.

### 6.2 Weekly menu

**Generation.** The user opens the week and requests a proposal. The service
gathers candidate recipes, excludes those cooked within the cooldown window, and
calls the LLM with a structured output schema returning 14 slots.

**Cooldown is a configuration value, default 3 days.** It filters candidates
passed to the LLM; it is not a prompt instruction, so it cannot be ignored.

**Editing is unconstrained.** The proposal only pre-fills the grid. The user can:

- assign any recipe to any slot (search via the shadcn `command` palette)
- clear a slot
- move a recipe between slots
- enter free text in a slot
- regenerate one slot, a day, or the whole week
- build a menu entirely by hand without ever invoking the LLM

The grid is the source of truth; the LLM is a convenience over it.

### 6.3 Shopping list

Pure computation, no LLM:

1. Collect every `MenuSlot` with a `recipeId` (free-text and empty slots ignored).
2. Expand to `RecipeIngredient` rows, scaled if servings differ from the recipe default.
3. Aggregate by `(name, unit)`, summing quantities. Incompatible units stay as separate lines rather than being coerced.
4. Ingredients with no quantity ("sale", "olio q.b.") collapse to a single unquantified line.
5. Assign an aisle from `IngredientAisle`; unknown names go to an "altro" group and prompt a one-time assignment.
6. Preserve `manual` items and existing `checked` state across regeneration.

**Sync between the two users** is required (one person shops, the other adds an
item from home). v1 uses polling: refetch on window focus, plus a short interval
while the list screen is open. Item state is last-write-wins per item, which is
adequate for two people and a checkbox. Server-sent events are a v2 upgrade if
polling proves insufficient.

### 6.4 Authentication

Two fixed users, seeded — no registration flow, no password reset UI (reset is a
CLI/manual operation).

- Password hashing with argon2id, via `@node-rs/argon2`. The conventional `argon2`
  and `bcrypt` packages are native addons and are a recurring source of failure on
  serverless runtimes; `@node-rs/argon2` ships prebuilt binaries that work there.
- Session cookie: `httpOnly`, `Secure`, `SameSite=Lax`, long expiry — the partner
  must not be asked to log in repeatedly. Re-login friction directly threatens
  success criterion 3.
- Rate limiting on the login endpoint (see §9.2).
- All routes except `/login` and the auth endpoint require a session.
- **Every server action authenticates and authorises inside itself.** A server
  action is a public endpoint: it can be invoked directly, so a session check in
  middleware, a layout or a page does not protect it. The order inside the action
  is validate, authenticate, authorise, mutate. Without this, "all routes require
  a session" is false for every mutation the app performs.

---

## 7. LLM integration

### 7.1 Single boundary

Every call to Anthropic goes through `lib/services/llm.ts`. No other file imports
the SDK. This keeps the provider, model and prompting strategy replaceable
without touching feature code.

```ts
// the entire surface exposed to the rest of the app
proposeMenu(candidates: RecipeSummary[], constraints: MenuConstraints): Promise<MenuProposal>
structureRecipe(pageText: string): Promise<RecipeDraft>
parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]>
guessAisles(names: string[]): Promise<Record<string, string>>
```

### 7.2 Implementation notes

- SDK: `@anthropic-ai/sdk`.
- Model: `claude-opus-5`, set via environment variable so it can be changed
  without a code edit.
- **Structured outputs** (`output_config.format` with a JSON schema derived from
  the Zod schemas in `lib/schemas/`) for every call. No free-text parsing.
- Prompts live as separate files, not inline string literals, so they can be
  edited and diffed independently.
- Every call is wrapped with a timeout and a single retry.

### 7.3 Cost expectation

v1 workload is one menu generation per week plus occasional import fallbacks —
on the order of **€0.50/month** on `claude-opus-5`. The gap to the cheapest model
in the family is roughly €0.40/month, which is not worth optimising. Revisit with
a month of real billing data, not with estimates.

---

## 8. Error handling

| Failure                           | Behaviour                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared URL unreachable / non-HTML | Confirmation screen opens with an empty draft and an explanatory message; user can enter the recipe manually. Never a dead end.                                      |
| No JSON-LD found                  | Silent fallback to the LLM path. Not surfaced to the user.                                                                                                           |
| LLM call fails or times out       | Import: manual entry offered. Menu: grid stays as-is with a retry affordance; a hand-built menu remains fully possible. **No LLM failure may block a core action.**  |
| Ingredient line unparseable       | Stored with `raw` populated, `quantity`/`unit` null. Appears in the shopping list unquantified and flagged for correction.                                           |
| Unknown ingredient aisle          | Grouped under "altro"; one-tap assignment persists it to `IngredientAisle`.                                                                                          |
| Concurrent checkbox writes        | Last-write-wins per item. Acceptable at this scale.                                                                                                                  |
| Database unreachable              | Explicit error state; no silent partial rendering.                                                                                                                   |
| Database cold (scaled to zero)    | Not an error. The first query after idle waits under a second for the wake-up; no special handling, but no route may set a timeout shorter than a couple of seconds. |
| Free-tier quota exhausted         | Neon suspends the compute until the monthly reset. Unreachable in the expected workload; if it ever happens the fix is an upgrade, not code.                         |

**Governing principle:** every LLM-assisted path has a working manual equivalent.
The app must remain fully usable with the Anthropic API unavailable.

---

## 9. Security

The app is exposed on the public internet. This is an accepted, deliberate
trade-off (chosen over Tailscale to avoid requiring a second app on the partner's
phone), and it raises the bar on the items below.

### 9.1 Secrets

`ANTHROPIC_API_KEY`, the session secret and the Neon connection strings live in
Vercel Environment Variables, and locally in a git-ignored `.env`. A committed
`.env.example` documents the names with empty values. Never a real secret in the
repository, never one hardcoded in source.

### 9.2 Authentication surface

- Login endpoint rate-limited by IP and by account (e.g. 5 attempts / 15 min).
- Generic failure messages; no user enumeration.
- Argon2id hashing with per-user salt.
- Optional future hardening: Vercel's WAF custom rules (3 available on Hobby) to
  rate-limit or geo-restrict the login path at the edge. Not in v1.

### 9.3 SSRF on the import fetcher — **required**

The import endpoint fetches an arbitrary user-supplied URL server-side. On the
original self-hosted design this was a request-forgery primitive aimed at the home
LAN, which made the guard urgent. On Vercel there is no home network behind the
fetcher, so the severity drops — but the controls are twenty lines of code, they
still block cloud metadata endpoints and internal address ranges, and they cost
nothing to keep. They remain required.

Mandatory controls:

- Allow `http`/`https` schemes only.
- Resolve the hostname and **reject private, loopback, link-local and reserved
  address ranges** (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`,
  `169.254/16`, `::1`, `fc00::/7`).
- Re-validate after every redirect; cap the redirect chain.
- Enforce a response size cap and a request timeout.
- Never return the raw upstream response body to the client.

### 9.4 Other

- Zod validation at every route handler boundary; never trust request bodies.
- Prisma parameterises queries; no raw SQL with interpolation.
- Recipe instructions are user/LLM-sourced markdown — sanitise before rendering.

---

## 10. Operations

### 10.1 Hosting

No owned host, nothing to keep running. Deployment is a push to the default
branch; Vercel builds and promotes it. Preview deployments on other branches are
useful and free, and the Neon integration can give each one its own database
branch.

There is no operational task left on the machine under the desk. This removes the
single largest downtime risk identified in the original design.

### 10.2 Domain

1. Add the project domain in the Vercel dashboard.
2. Create the `CNAME` record it asks for at the existing registrar (GoDaddy).
3. Verify the certificate is issued and the app serves over HTTPS.

The `cristofaro.dev` nameservers are **not** moved, and no existing record — in
particular the GitHub Pages ones — is modified. This is the whole migration.

### 10.3 Backup — none in v1

**Decision: v1 ships with no backup of its own.** The only recovery available is
what Neon's free plan provides: six hours of instant-restore history plus one
manual snapshot.

That covers an accidental deletion noticed the same day. It does not cover losing
the account, the provider, or a corruption found a week later. This is an accepted
risk, taken knowingly.

What it costs if it goes wrong: the recipe book, which is the only irreplaceable
data in the system — menus and shopping lists are regenerated weekly and worthless
after seven days. The mitigation, if the risk ever stops feeling acceptable, is a
scheduled `pg_dump` against the direct connection string from any host that can
run it. Nothing in the design has to change to add it later.

The earlier revision of this document specified a nightly off-site dump. That
requirement is withdrawn.

### 10.4 Bootstrap (before v1 goes live)

Populate the recipe book with ~30 recipes using Claude Code on the host: dictate
the ones held only in memory, supply URLs for the rest, and write directly to the
database or generate a seed file. Zero API cost, zero application code.

The app must be populated on the partner's first use. An empty app that asks for
data entry is the primary abandonment risk.

---

## 11. Testing strategy

Proportionate to a two-user personal app: cover what is costly to get wrong,
skip what is obvious.

**Unit tests (Vitest) — the shopping list aggregator is the highest-value target.**
It is pure, deterministic, and the component whose failure is both most likely and
most damaging (a wrong list is discovered at the supermarket).

- Aggregation across recipes sharing an ingredient
- Servings scaling
- Incompatible units kept separate, not coerced
- Unquantified ingredients ("q.b.") collapsed correctly
- Free-text and empty menu slots excluded
- `manual` items and `checked` state preserved across regeneration

**Unit tests — ingredient parser.** A fixture table of real Italian ingredient
strings mapped to expected `{quantity, unit, name}`, extended with every line the
parser gets wrong in practice.

**Unit tests — JSON-LD extractor.** Saved HTML fixtures from the recipe sites
actually used, including at least one page with no JSON-LD to exercise the
fallback branch.

**Integration tests.** Import pipeline end to end against fixtures with the LLM
stubbed; menu generation with the LLM stubbed; shopping list generation from a
seeded menu.

**Manual acceptance checklist (must pass on the partner's phone, not a desktop
browser):**

1. Install the PWA from the browser and launch it from the home screen.
2. Share a recipe link from Chrome, and again from Instagram — verify the URL
   arrives via the `text` parameter path.
3. Generate a menu, then rearrange it substantially by hand.
4. Generate a shopping list, tick items while the other user adds one, verify
   both see the change.
5. Leave the app untouched for at least a day, then open it cold from the home
   screen: the Neon compute will have scaled to zero, and the wake-up must be
   invisible rather than an error.

**Not tested:** shadcn/ui component internals, Prisma itself, LLM output quality
(evaluated by use, not by assertion).

---

## 12. Open questions

Resolve during implementation; none block starting.

1. **App name and hostname.**: `personal-productivity.cristofaro.dev`
2. **Ingredient name normalisation depth.** Are "pomodori pelati" and "pelati"
   the same shopping-list line? A synonym table may be needed; start without one
   and add it when the first duplicate annoys someone.
3. **Week boundary.** Monday-start assumed. Confirm.
4. **Servings default.** Fixed at 2, or per-recipe with scaling at menu time?
   The model supports scaling; the UI decision is open.

---

## 13. Next step

Produce the implementation plan from this document. The scaffolding — Next.js,
shadcn/ui, Prisma wired to Neon, Vitest, the enforced boundary rules and the
project conventions in `CLAUDE.md` and `docs/conventions/` — is done separately
and before the plan. The plan assumes it exists and starts from the data model.
