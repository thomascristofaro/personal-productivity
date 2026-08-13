# Architecture conventions

The short version is in `CLAUDE.md`. This file explains the reasoning and settles
the edge cases. Everything here is a project decision; general React and Next.js
craft comes from the skills (see the end of the file).

## Folder layout

```
app/
  (app)/…                 pages and layouts
  api/…/route.ts          HTTP handlers
  manifest.ts             web app manifest, including share_target
components/
  ui/                     shadcn/ui components — generated, owned, editable
  …                       feature components composed from components/ui
hooks/                    client-side React hooks
lib/
  services/               DOMAIN LAYER — the logical backend
  schemas/                Zod schemas — the shared contract
  db.ts                   Prisma client singleton
  env.ts                  validated environment variables
  auth.ts                 session handling
  utils.ts                cn() and similar leaf helpers
prisma/
  schema.prisma
test/stubs/               module stubs used by Vitest
docs/
  conventions/            this directory
  superpowers/specs/      design documents
```

## The dependency direction

Dependencies point inward. `lib/services/` is the innermost layer and knows
nothing about the layers above it.

| From              | May import                                                                        | May **not** import                                        |
| ----------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `app/**`          | anything                                                                          | —                                                         |
| `components/**`   | `components/**`, `hooks/**`, `lib/schemas`, leaf modules                          | `lib/services/**`, `lib/db`, `lib/env`                    |
| `lib/services/**` | `lib/services/**`, `lib/schemas/**`, `lib/db`, leaf modules, node built-ins, SDKs | `app/**`, `components/**`, `hooks/**`, `react`, `next/**` |
| `lib/schemas/**`  | `zod` only                                                                        | everything else                                           |

A **leaf module** is a file directly under `lib/` that imports nothing but `zod`
and other leaf modules: `utils.ts`, `config.ts`, `week.ts`, `aisles.ts`. They
carry constants and pure arithmetic, they reach neither the database nor the
network, and both layers may import them. Anything that grows a dependency
outside that set stops being a leaf and moves into `lib/services/`.

`lib/schemas/` importing nothing but Zod is deliberate: schemas are shared between
client and server, so anything they drag in gets bundled for the browser.

`eslint.config.mjs` encodes this table. A violation fails `pnpm verify`.

### Three rules that are easy to get wrong

**Client components never import a service.** A service reaches the database and
the Anthropic SDK; importing one from a client component either fails the build or
leaks server code. Data reaches a client component through props from a server
component, or through a server action.

**A service never receives a `Request`, and never reads the session itself.** No
`cookies()`, no `headers()`. If a service needs the current user it takes an
`actorId: string`; extracting it from the session is the caller's job.

Next.js documents the opposite pattern — a data access layer that calls
`cookies()` internally — and it has a real advantage: nothing is passed, so
nothing can be passed wrong. We diverge deliberately, for three reasons:

- Services stay testable as plain functions. A service that reads cookies needs a
  faked request context to test at all, which is precisely the smell this
  document warns about.
- Services stay callable from outside a request. The recipe bootstrap of design
  document §10.4 is a script, not an HTTP handler.
- Services stay portable, which is why the design document created the layer.

Note what does **not** move: authorisation stays in the service. "Does this actor
own this recipe?" is a domain question. Only identity _extraction_ moves out — the
transport establishes who you are, the domain decides what you may do.

**A server action is a public endpoint.** It is a thin caller like a route
handler, and it carries the same obligations: validate the input with Zod,
authenticate, authorise, and only then call the service. Middleware, layout guards
and page-level checks do not protect it, because it can be invoked directly.
Order matters — validate, authenticate, authorise, mutate.

### `actorId` is a reserved name

The cost of not reading the session inside services is that a caller can pass the
wrong identity. One convention contains it:

**`actorId` means an identity already verified by the caller. It comes from the
session, never from a request payload.** Never name a parameter `userId` when it
carries the caller's own identity, and never accept `actorId` as client input:

```ts
// WRONG — anyone can send someone else's id. This is an IDOR.
const { actorId, recipeId } = InputSchema.parse(body)
await deleteRecipe(actorId, recipeId)

// RIGHT — identity from the session, payload for everything else
const { recipeId } = InputSchema.parse(body)
const session = await requireSession()
await deleteRecipe(session.userId, recipeId)
```

ESLint rejects a property named `actorId` in `lib/schemas/`, because anything in a
schema arrives from the network and is by definition unverified.

## Naming

| Thing                   | Convention                             | Example                            |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| Files and directories   | `kebab-case`                           | `shopping-list.ts`                 |
| React components        | `PascalCase`, one main export per file | `ShoppingListItem`                 |
| Component files         | `kebab-case` matching the component    | `shopping-list-item.tsx`           |
| Functions and variables | `camelCase`                            | `aggregateIngredients`             |
| Types and interfaces    | `PascalCase`, no `I` prefix            | `RecipeDraft`                      |
| Zod schemas             | `PascalCaseSchema` + inferred type     | `RecipeDraftSchema`, `RecipeDraft` |
| Constants               | `SCREAMING_SNAKE_CASE`                 | `DEFAULT_COOLDOWN_DAYS`            |
| Prisma models           | `PascalCase` singular                  | `MenuSlot`                         |
| Booleans                | `is` / `has` / `can` prefix            | `isChecked`                        |

## Service design

Every service module owns one concept and exposes named functions. No default
exports, no classes, no `index.ts` barrel files — barrels defeat tree-shaking and
make the import graph unreadable.

A service function should be describable in one sentence. If describing it needs
"and", it is two functions.

Every **exported** function carries a TSDoc block: summary, `@param`, `@returns`,
`@throws` where it throws. No types in the annotations — TypeScript supplies
those. Private helpers in the same file need nothing. ESLint enforces this.

Services return values or throw typed errors. They never return `{ ok, error }`
envelopes; shaping a response is the caller's job.

## Errors

- Throw for exceptional conditions, return values for expected outcomes. "The
  page has no JSON-LD" is an expected outcome and returns `null`; "the database is
  unreachable" throws.
- Never swallow an error to render a partial page. A failed fetch produces an
  explicit error state in the UI.
- Never `catch` without either handling or rethrowing with context.

## Configuration

Anything tunable — the menu cooldown window, the LLM model id, timeouts — is a
named constant or an environment variable, never a number typed inline at the
point of use.

Environment variables are read and validated in `lib/env.ts` and nowhere else, so
a missing variable fails at startup rather than at the first request that needs
it. ESLint forbids `process.env` elsewhere.

## What is deliberately not in this file

| Topic                                                     | Where                                         |
| --------------------------------------------------------- | --------------------------------------------- |
| Data fetching, waterfalls, Suspense, caching, bundle size | `.agents/skills/vercel-react-best-practices/` |
| Component API design and composition                      | `.agents/skills/vercel-composition-patterns/` |
| Prisma queries, migrations, CLI                           | `.agents/skills/prisma-*/`                    |
| Next.js APIs in this version                              | `node_modules/next/dist/docs/`                |
