# Data conventions

Postgres on Neon, accessed through Prisma. Zod validates everything that crosses
a boundary.

Only project decisions are recorded here. Prisma's own API — queries, filters,
relations, transactions, CLI commands — is documented in
`.agents/skills/prisma-client-api/` and `.agents/skills/prisma-cli/`, which are
current for version 7 and should be consulted rather than recalled.

## Neon

Neon is used as **Postgres and nothing else**. No Neon-specific extension, no
branching logic in application code, no provider SDK. The database stays portable
behind Prisma, and swapping provider stays a matter of changing two environment
variables.

### Two connection strings

Serverless functions open many short-lived connections, which a plain Postgres
connection limit cannot absorb. Neon provides a pooler for that. Prisma
migrations, on the other hand, need a direct connection — the pooler cannot run
them.

In Prisma 7 these are configured in two different places, because the CLI and the
runtime no longer share a connection setup:

| Endpoint | Variable       | Configured in                       | Used by                           |
| -------- | -------------- | ----------------------------------- | --------------------------------- |
| direct   | `DIRECT_URL`   | `prisma.config.ts`                  | migrations, studio, introspection |
| pooled   | `DATABASE_URL` | `lib/db.ts`, via the driver adapter | the application                   |

`schema.prisma` declares only `provider = "postgresql"`; it carries no URL at
all. Do not add `url` or `directUrl` to it — `directUrl` is not a valid
`prisma.config.ts` option in this version either.

Getting the two endpoints backwards produces failures that do not look like
connection problems: migrations that hang, or a build that works locally and
exhausts connections in production. Both variables are set in `.env` locally and
in Vercel Environment Variables in production.

### Scale to zero

The compute suspends after five minutes of inactivity and wakes on the next
query, in well under a second. Two consequences:

- No query timeout shorter than a couple of seconds. A cold wake is not an error.
- The first request after an idle period is slower. Do not "fix" this with a
  keep-alive ping — it burns the monthly compute allowance for nothing.

## Prisma

- One `PrismaClient` for the whole app, exported as `db` from `lib/db.ts` with the
  global singleton pattern that survives hot reload in development. Never
  construct one anywhere else. ESLint enforces this.
- Prisma 7 specifics, easy to get wrong from older habits: the client is
  generated into `lib/generated/prisma` (git-ignored, rebuilt by `postinstall`)
  and imported from there, **not** from `@prisma/client`; and `new PrismaClient()`
  throws unless it is given a driver adapter. We use the generic `@prisma/adapter-pg`
  rather than a Neon-specific adapter, so the database stays portable.
- Only `lib/services/` and `lib/db.ts` talk to Prisma. A route handler or a
  component that imports the client is a layering violation.
- Select what you need. Avoid returning whole rows when a service exposes a
  narrower type.
- Use `include` deliberately: the shopping-list aggregation touches every
  ingredient of every selected recipe, and an N+1 there is the difference between
  instant and noticeable.
- Wrap multi-write operations in a transaction. Regenerating a shopping list
  deletes and recreates rows; a half-applied regeneration is a lying list.

### Running services from a script

`lib/db.ts` imports `server-only`, whose default entry point throws. A script
that imports the domain layer must therefore run with the `react-server`
condition, which resolves that guard to an empty module:

    node --conditions=react-server --import tsx <script>.ts

`prisma db seed` is configured this way in `prisma.config.ts`. Vitest solves the
same problem differently, aliasing `server-only` to `test/stubs/server-only.ts`.
Neither weakens the guard: it still fires in a browser bundle, which is its job.

### Migrations

- Every schema change goes through `pnpm db:migrate`. Migration files are
  committed.
- Never edit an applied migration. Write a new one.
- `db:push` is for throwaway experiments on a scratch database only. Never on a
  database that holds real recipes.
- Migration names describe the change: `add_ingredient_aisle`, not `update`.

## Zod

Schemas live in `lib/schemas/`, one file per concept, and import nothing but
`zod`. They are the contract shared by the client, the route handlers and the LLM
structured outputs — so the same schema that validates a form submission also
defines the JSON schema sent to Anthropic.

- Validate at the **route-handler boundary**, before anything else runs. Never
  trust a request body, a query parameter or a share-target parameter.
- Derive TypeScript types from schemas with `z.infer`. Do not maintain a type and
  a schema separately — they will drift.
- Parse, do not cast. `as` on external data defeats the entire mechanism.
- Validate LLM output with the same schema used to request it. Structured outputs
  reduce the failure rate; they do not eliminate it.

## Modelling rules from the design

Two commitments worth restating, because both are easy to "simplify" away and
both exist for a reason:

**`RecipeIngredient.raw` is always preserved.** The original ingredient string is
stored alongside the parsed quantity, unit and name. When parsing is wrong the
user can still see and correct what the source actually said. Nothing is ever
lost to a parser.

**`ShoppingListItem.manual` survives regeneration.** Items added by hand
(`sacchetti`, `detersivo`) and the checked state of existing items must outlive a
menu edit that regenerates the list. A regeneration that silently deletes what
someone typed is worse than no regeneration.

## Dates and time

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

## Environment variables

| Variable            | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `DATABASE_URL`      | pooled Neon connection, used by the app     |
| `DIRECT_URL`        | direct Neon connection, used by migrations  |
| `ANTHROPIC_API_KEY` | Anthropic Messages API                      |
| `ANTHROPIC_MODEL`   | model id, so it changes without a code edit |
| `AUTH_SECRET`       | session cookie signing                      |

Names are documented in `.env.example` with empty values, which is committed.
Real values live in `.env` (git-ignored) and in Vercel Environment Variables.
Read and validate them in one module at startup, so a missing variable fails
immediately rather than at the first request that needs it.
