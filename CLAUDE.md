# personal-productivity

A personal app for two users, on Vercel with a Neon Postgres database. The first
module is the weekly menu and shopping list; personal finance and a news reader
are planned as separate modules sharing the shell, the database and the
deployment.

It doubles as the base for a wider project template, so the structure is expected
to outlive this app. Prefer the decision that generalises.

Design documents are in `docs/superpowers/specs/`; the current one is
`2026-08-13-menu-spesa-design.md`. Read it before implementing a feature — it
settles decisions that must not be relitigated. `docs/roadmap.md` says which
parts of it are built and what is next.

## Two kinds of knowledge

**Decisions** are true because this project decided them. No external source can
supply them. They live in this file and in `docs/conventions/`.

**Craft** is how to write good React, accessible UI, fast data fetching. It is
industry knowledge, not ours. It lives in the vendor skills under
`.agents/skills/`, which are versioned in `skills-lock.json` and updated
deliberately with `skills update`.

Do not copy craft into this repository's documents. Consult the skill instead.

### Precedence

This file and the design document **bind**. The skills **advise**.

Where they disagree, the project document wins — and say so out loud rather than
silently following one or the other. If the skill is right, change the project
document; do not work around it.

### Craft or platform: the portability test

A `vendor-` prefix names the author, not the scope. Vercel writes React guidance
because it employs the people who build React and Next.js; that guidance is craft
and travels anywhere. But a vendor also has a legitimate interest in patterns that
work best on its own platform — `client-swr-dedup` recommends SWR, which is a
Vercel library. Not bad faith, just perspective.

Before adopting a rule, ask:

> **Would this still make sense if this app moved to a plain VPS tomorrow?**

- "Don't define components inside other components" — yes, always. Craft, adopt it.
- "Use `after()` for non-blocking work" — depends on the runtime. Weigh it.
- "Store files in Vercel Blob" — no. Platform, and outside our decisions.

The same test applies to the database: we use Postgres through Prisma with the
generic `pg` adapter, and no Neon-specific feature, so moving provider is two
environment variables. Keep it that way.

### When to consult which skill

| Situation                                                     | Skill                                               |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Designing a component API, or a component grew boolean props  | `vercel-composition-patterns`                       |
| Data fetching, server components, route handlers, bundle size | `vercel-react-best-practices`                       |
| **Before declaring any UI work done**                         | `web-design-guidelines`, run over the changed files |
| Adding, styling or debugging a shadcn component               | `shadcn`                                            |
| Porting a Radix-based snippet found online                    | `migrate-radix-to-base`                             |
| Any Prisma schema, query or CLI work                          | `prisma-client-api`, `prisma-cli`                   |

`vercel-react-best-practices` ranks its own rules by impact. Follow that ranking
rather than a case-by-case judgement: apply the CRITICAL and HIGH categories
(`async-`, `bundle-`, `server-`) by default, because they are architectural and
cheap to get right early. Apply the LOW ones (`js-`, `advanced-`) only when
something is measurably slow.

### Known divergences, so nobody "fixes" them

- `server-no-shared-module-state` looks like it forbids the Prisma singleton in
  `lib/db.ts`. It does not — the rule exempts process-wide singletons that hold no
  request-scoped data. Leave `lib/db.ts` alone.
- `vercel-composition-patterns` favours compound components sharing Context. A
  Context provider is a client component and pulls the boundary up the tree.
  Compose by passing `children` from a server component first; reach for Context
  only when there is genuinely shared interactive state.

## Decisions

Binding. If one blocks you, say so and stop — do not work around it.

### Layering

`lib/services/` is the backend. Everything that decides anything lives there.

- No imports from `app/`, `components/` or `hooks/`.
- No React, no `next/*`.
- No `Request`, `Response`, `cookies()` or `headers()`.
- Typed arguments in, typed values out.

Route handlers, server components and server actions are **thin callers**: parse
input, check auth, call a service, shape the response. No domain logic.

ESLint enforces this. A violation fails `pnpm verify`.

### Security

- Zod validates every external input, at the route handler **and inside every
  server action**. A server action is a public endpoint: it can be invoked
  directly, and middleware or page-level guards do not protect it.
- Every server action authenticates and authorises **inside itself**, before
  touching data. Validate, then authenticate, then authorise, then mutate.
- **`actorId` is a reserved name**: it means an identity already verified by the
  caller, and it always comes from the session, never from a request payload.
  ESLint rejects it in `lib/schemas/`. Passing a client-supplied id as `actorId`
  is how this architecture produces an IDOR — see `docs/conventions/architecture.md`.
- Never a real secret in the repository. Names in `.env.example`, values in `.env`
  locally and in Vercel Environment Variables in production.
- No raw SQL with string interpolation. Prisma parameterises.

### UI

- Every base component comes from **shadcn/ui**. No other component library is
  added, and no base component is hand-written. Missing one? Compose it from
  shadcn primitives. Changing one? Edit it in place in `components/ui/` — it is
  our source now, do not wrap it.
- Server components by default. `"use client"` only where interactivity requires
  it, as far down the tree as possible.
- Phone first, desktop tolerable.

Craft beyond this — accessibility, layout, states, performance — comes from the
skills, not from this file.

### Data

- Prisma is the only database access path. Import `db` from `lib/db.ts`; never
  construct a client elsewhere.
- Schemas live in `lib/schemas/` and are the contract shared by the client, the
  route handlers and the LLM structured outputs.
- Schema changes go through a migration. Never edit the database by hand.

### LLM

- Every Anthropic call goes through `lib/services/llm.ts`. No other file imports
  the SDK. ESLint enforces this.
- Structured outputs only. Prompts in their own files, never inline literals.
- **Every LLM-assisted path has a working manual equivalent.** The app stays fully
  usable with the API down. Product requirement, not a nicety.

### Language

Italian for what the user reads. English for everything else.

- **Italian**: UI labels, buttons, user-facing error messages, page titles, the
  PWA manifest, `lang="it"`.
- **English**: identifiers, comments, TSDoc, file names, commit messages, branch
  names, documentation, test names, log messages.
- Database **names** are English even when the concept is Italian: `MealType.LUNCH`,
  `weekStart`, `aisle`. Database **values** stay Italian, because they are data:
  `"ortofrutta"`, `"320 g di spaghetti"`.

### Comments

Comment as little as possible. Three rules:

1. **Document the interface.** Every exported function in `lib/services/` carries
   a TSDoc block: one-line summary, `@param`, `@returns`, `@throws` if it throws.
   No types — TypeScript has those. This is what appears in the editor and what
   generates documentation. ESLint enforces it; private helpers are exempt.
2. **Inside a body, explain only _why_.** A comment earns its place when it
   explains a non-obvious decision, a workaround, or a trap that reads as a bug
   without it. If it restates the code, delete it.
3. **Configuration files point, they do not duplicate.** One line referring to the
   convention document, not a paragraph repeating it.

No section-divider comments, no commented-out code.

## Working agreement

- **Run `pnpm verify` before claiming anything works.** Typecheck, lint, tests.
  "It should work" is not a report; the command output is.
- UI work is not done until `web-design-guidelines` has been run over the changed
  files and its findings addressed or explicitly dismissed.
- Test what is costly to get wrong. Do not test shadcn internals, Prisma itself,
  or LLM output quality. See `docs/conventions/testing.md`.
- A file that has grown large is doing too much. Split it.
- Errors are explicit states. Never render a partial page over a failed fetch.
- `main` deploys to production. Feature work happens on a branch.

### Reporting back

The owner reads a report to find out what is required of them. Anything that does
not serve that is noise. Close a piece of work with three short sections, in this
order and under these headings:

1. **Cosa devi fare tu** — concrete actions, or `Niente.` in one line. Never bury
   an action further down.
2. **Cosa ho fatto** — one or two lines.
3. **Cosa faccio ora** — what comes next. Ask a question only when genuinely
   blocked, and then name what the block is.

Three rules that come from getting it wrong:

- **Never mix local, test and production in one section.** Split by environment,
  or say which one applies. A redirect URI for localhost and one for production
  are two different instructions and reading them together helps nobody.
- **Do not stop between the tasks of a plan to ask whether to continue.** Keep
  going and report at the end. Stopping without a stated blocker reads as waiting
  for something.
- **A finding that changed nothing belongs in the commit message or the plan
  file, not in the report.** "Things the plan did not foresee" is not an action;
  if it needs no decision from the owner, it is not worth their attention.

Be direct and short. The owner has asked for this twice.

## Commands

| Command                                        | Purpose                             |
| ---------------------------------------------- | ----------------------------------- |
| `pnpm dev`                                     | development server                  |
| `pnpm verify`                                  | typecheck + lint + tests — the gate |
| `pnpm test` / `pnpm test:watch`                | tests                               |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | individually                        |
| `pnpm db:migrate`                              | create and apply a migration (dev)  |
| `pnpm db:deploy`                               | apply migrations (production)       |
| `pnpm db:studio`                               | browse the database                 |
| `pnpm db:generate`                             | regenerate the Prisma client        |

## Where things are

**Start here in a new session: [`docs/roadmap.md`](docs/roadmap.md)** — what has
shipped, what is in flight, what comes next and in which order, and what is
parked. It is the only place that records state; keep it current.

Project-specific detail, in `docs/conventions/`:

- [`architecture.md`](docs/conventions/architecture.md) — layers, folder layout, what may import what
- [`ui.md`](docs/conventions/ui.md) — the UI decisions that are ours
- [`data.md`](docs/conventions/data.md) — Prisma 7, Neon, Zod, migrations
- [`testing.md`](docs/conventions/testing.md) — what is tested and what is not

Vendor documentation on disk, current where training data is not:

- `node_modules/next/dist/docs/` — Next.js breaking changes
- `.agents/skills/prisma-*/` — Prisma 7 generates into `lib/generated/prisma`, needs
  an explicit driver adapter, keeps URLs in `prisma.config.ts`
- `.agents/skills/shadcn/` — including `rules/base-vs-radix.md`; this project
  is on Base UI, so most shadcn examples online do not transfer verbatim
- `.agents/skills/vercel-*`, `.agents/skills/web-design-guidelines/`

`.claude/skills/` mirrors `.agents/skills/` as symlinks and is git-ignored. The
real files are in `.agents/`.
