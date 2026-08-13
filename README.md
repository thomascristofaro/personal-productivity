# personal-productivity

A personal app for two people. The first module plans the weekly menu and derives
the shopping list from it; personal finance and a filtered news reader are planned
as later modules sharing the same shell, database and deployment.

Next.js on Vercel, Postgres on Neon, shadcn/ui, Prisma, Vitest.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in the values
pnpm db:migrate
pnpm dev
```

## Commands

| Command           | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | development server                            |
| `pnpm verify`     | typecheck + lint + tests — run before pushing |
| `pnpm test`       | tests only                                    |
| `pnpm db:migrate` | create and apply a migration                  |
| `pnpm db:studio`  | browse the database                           |

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — the binding development rules
- [`docs/conventions/`](docs/conventions/) — architecture, UI, data and testing conventions
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design documents
