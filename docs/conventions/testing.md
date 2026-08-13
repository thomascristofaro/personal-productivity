# Testing conventions

This is a personal app for two users. The testing budget goes where a defect is
both likely and expensive, and nowhere else. Coverage percentage is not a goal
and is not measured.

## Runner

Vitest, node environment. Test files sit next to the code they cover, named
`*.test.ts`. The `@/` alias works in tests exactly as it does in the app.

```
pnpm test          # once
pnpm test:watch    # while working
pnpm verify        # typecheck + lint + test — the gate before claiming done
```

## What is tested

**The shopping-list aggregator — the highest-value target in the project.** It is
pure, deterministic, and its failure mode is discovered at the supermarket with a
list that lies. Cases that must be covered:

- aggregation across recipes sharing an ingredient
- scaling when servings differ from the recipe default
- incompatible units kept as separate lines, never coerced
- unquantified ingredients (`q.b.`) collapsed to one line
- free-text and empty menu slots excluded from the list
- `manual` items and `checked` state preserved across regeneration

**The ingredient parser.** A fixture table of real Italian ingredient strings
mapped to the expected `{quantity, unit, name}`. Every line the parser gets wrong
in real use is added to the table before it is fixed.

**The JSON-LD extractor.** Saved HTML fixtures from the recipe sites actually
used, including at least one page with no JSON-LD, so the LLM fallback branch is
exercised.

**Integration paths, with the LLM stubbed.** The import pipeline end to end
against fixtures; menu generation; shopping-list generation from a seeded menu.

## What is not tested

Stated explicitly so nobody adds it later out of habit:

- shadcn/ui component internals
- Prisma itself
- LLM output quality — evaluated by use, not by assertion
- getters, trivial mappers, and anything whose test would restate the
  implementation

## How tests are written

- Test behaviour through the public function, not internals. If a test needs to
  reach into a module's private state, the module's boundary is wrong.
- One assertion subject per test. The test name states the expected behaviour:
  `keeps incompatible units on separate lines`, not `test aggregator 3`.
- Table-driven tests for parsers. `it.each` over a fixture array beats twelve
  near-identical test bodies.
- Fixtures are real data. Saved HTML from actual recipe sites, ingredient strings
  copied from actual recipes. Invented data tests an invented problem.
- No network in tests. No real Anthropic call, ever — the LLM boundary in
  `lib/services/llm.ts` exists partly so it can be stubbed in one place.

Services are directly testable because they take plain arguments and return plain
values (see `architecture.md`). If testing one requires faking a `Request`, a
session or a React tree, the layering has been violated — fix that rather than
building the fake.

## Test-driven where it pays

For the aggregator and the parsers, write the failing test first. Both are
specified by examples, both are pure, and both are cheaper to design through
their expected output than through their implementation.

For UI wiring, tests written first mostly slow things down. Build it, use it on a
phone, and cover it only if it breaks twice.

## Manual acceptance

Some of this system cannot be tested automatically, and the parts that cannot are
the parts most likely to end in abandonment. Before the module is considered done,
on the partner's phone — not a desktop browser:

1. Install the PWA from the browser and launch it from the home screen.
2. Share a recipe link from Chrome, then again from Instagram, and confirm the URL
   arrives through the `text` parameter path.
3. Generate a menu, then rearrange it substantially by hand.
4. Generate a shopping list, tick items while the other user adds one, and confirm
   both see the change.
5. Leave the app untouched for a day, then open it cold: the database will have
   scaled to zero and the wake-up must be invisible.

There is no backup to restore: v1 relies on Neon's six-hour instant-restore
window, as an accepted risk (design document §10.3).
