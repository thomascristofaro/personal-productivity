# personal-productivity

A personal app for two people. The first module plans the weekly menu and derives
the shopping list from it; personal finance and a filtered news reader are planned
as later modules sharing the same shell, database and deployment.

Next.js on Vercel, Postgres on Neon, shadcn/ui, Prisma, Vitest.

## Getting started

Development runs against a Postgres container, never against production. Docker
is therefore a prerequisite.

```bash
pnpm install
cp .env.example .env      # fill in the values; leave the database URLs as they are
docker compose up -d      # Postgres 18 on port 5433
pnpm db:deploy            # apply the migrations
pnpm db:seed              # two users and the catalogue
pnpm dev
```

The production credentials belong in Vercel Environment Variables and must not
be copied into `.env` — see [`docs/conventions/data.md`](docs/conventions/data.md).
Migrations reach production through `pnpm build`, which runs
`prisma migrate deploy` before building.

## Commands

| Command           | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | development server                            |
| `pnpm verify`     | typecheck + lint + tests — run before pushing |
| `pnpm test`       | tests only                                    |
| `pnpm db:migrate` | create and apply a migration                  |
| `pnpm db:deploy`  | apply existing migrations                     |
| `pnpm db:studio`  | browse the database                           |

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — the binding development rules
- [`docs/conventions/`](docs/conventions/) — architecture, UI, data and testing conventions
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design documents
