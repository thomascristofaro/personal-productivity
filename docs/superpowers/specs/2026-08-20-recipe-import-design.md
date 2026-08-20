# Recipe import — design

2026-08-20. Implements §6.1 of
[`2026-08-13-menu-spesa-design.md`](2026-08-13-menu-spesa-design.md), with the
LLM half deferred. §6.1, §8, §9.3 and §12 bind; this document settles what they
leave open and records what was measured rather than assumed.

## 1. What this is

A shared link becomes a filled-in recipe form. Two ways in, one screen out:

- **Android share sheet.** The installed PWA appears in the share sheet. Sharing
  a link opens the app on `/import`, which fetches the page, reads it, and
  renders the recipe form with the values in it.
- **Paste a link.** `/import` with no parameters offers a field. From there the
  path is identical.

The confirmation screen is **never skipped** (§6.1). Wrong quantities propagate
into the shopping list, and a shopping list that lies is worse than none.

## 2. What this is not, in v1

**No LLM.** §6.1's pipeline has JSON-LD first and an LLM fallback for pages
without it. v1 ships only the first half. The reasons:

- The design document already calls the LLM "a fallback, not the default path".
- The app has no LLM plumbing at all today — no `lib/services/llm.ts`, no SDK, no
  key. Building it here would debut two new systems at once, and when a share
  target silently does nothing, the first question is _which_ of them failed.
- Whether the fallback earns its cost is a question about real pages. Shipping
  the deterministic half answers it with data instead of estimates.

Deferred with it: `parseIngredientLines`' LLM fallback for lines the Italian
parser cannot read, and `guessAisles`. A new catalogue entry is created in
`altro` and corrected in `/catalogo`, which already exists for that.

`.env.example` documents `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` already.
`lib/env.ts` does **not** validate them, and must not until the code that
consumes them lands — that is the rule written at the top of the file.

## 3. What was measured

The owner supplied a real target: `https://www.cucchiaio.it/ricetta/ricetta-insalata-riso/`
— the page their partner would actually share. Probed on 2026-08-20:

**The `schema.org/Recipe` block is not valid JSON.** It carries raw newlines
inside string literals; `JSON.parse` rejects it at the first one. Escaping
control characters that sit inside string literals recovers the block whole —
six characters added to 3 498. **A strict reader would have found nothing on the
one page we know the users want.** This is the single most important finding
here, and it is why §4 specifies a tolerant read rather than `JSON.parse`.

**The fields do not have the shape of our columns:**

| The page publishes                                 | We store                 |
| -------------------------------------------------- | ------------------------ |
| `recipeYield: "4 - 6 porzioni"`                    | `servings: Int?`         |
| `prepTime: "PT25M"`, `cookTime: "PT15M"`, no total | `totalMinutes: Int?`     |
| `recipeInstructions`: three `HowToStep` objects    | one plain-text field     |
| nine free-text Italian ingredient lines            | `{quantity, unit, name}` |

**The existing parser handles all nine lines**, including the three with no
quantity. `lib/services/ingredient-parse.ts` needs no change:

```
300 g di riso                  -> 300 g · riso
15 pomodori cliegino           -> 15 · pomodori cliegino      (typo is the site's)
prezzemolo                     -> prezzemolo
```

**Three of the nine are already in the catalogue**, of 113 entries. Six are new
on one recipe — which is what §7 is about.

## 4. The pipeline

`lib/services/import.ts` exposes one function:

```ts
importRecipeFromUrl(url: string): Promise<RecipeDraft | null>
```

`null` is not an error. It means "that page held no readable recipe", which is
an ordinary outcome the screen has an answer for. The function throws only for
genuine faults.

Steps, in order:

1. **Guard the URL** (§5) and fetch.
2. **Read every `<script type="application/ld+json">`** through `lib/json-ld.ts`,
   which escapes control characters inside string literals before parsing and
   skips a block that is still unreadable. A page with two blocks and one broken
   must still yield the other.
3. **Find the `Recipe` node** — top level, inside an array, or inside `@graph`,
   and `@type` may itself be an array.
4. **Map it.** Three rules, chosen because the confirmation screen exists to
   correct them:
   - `recipeYield` → the **first** number in the text; none, then empty.
   - `totalMinutes` → `totalTime`, else `prepTime + cookTime`, else empty. ISO
     8601 durations parsed by `lib/duration.ts`.
   - `recipeInstructions` → the steps' text joined with blank lines.
5. **Parse each ingredient line** with the existing `parseIngredientLine`.

`RecipeDraft` is a domain type — `servings: number | null`, not a string. The
page converts to form strings, which is what `/recipes/[id]/edit` already does.

## 5. The URL guard

`lib/url-guard.ts`. Required by §9.3, and twenty lines:

- `http` and `https` only.
- Resolve the hostname; reject private, loopback, link-local and reserved ranges
  — `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`,
  `fc00::/7`.
- Follow redirects **manually**, re-validating each hop, capped at three.
- Cap the response size and the request timeout.
- **Never return the upstream body to the client.** Only a mapped draft leaves
  the service.

**Residual, stated rather than hidden:** between resolving the name and the
connection being made, a hostile DNS server can answer differently. Closing that
means connecting by IP with a forced `Host` header, which is considerably more
code. §9.3 asks for the level specified above, and on Vercel there is no home
network behind the fetcher.

## 6. The screen

One route, `/import`, three states decided by the search params.

| State            | What renders                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| no link          | a paste field, in `DetailBody` under `PageHeader`                                                                                 |
| a link, read     | `RecipeForm` with the draft in it                                                                                                 |
| a link, not read | the **same** `RecipeForm`, empty, the link already in Fonte, under «Non sono riuscito a leggere questa pagina. Compilala a mano.» |

**The incoming `url` is validated with Zod before anything touches it**, against
the same `http(s)`-only rule `RecipeInputSchema.sourceUrl` already applies. A
value that fails is not an error page: it lands in the third row above, because
from the user's side "I could not read this" and "that was not a link" have the
same answer.

The third row is §8's rule — no LLM-assisted path may dead-end — and it costs
nothing, because the manual equivalent is the same component with no values.

**The link comes from `url`, and from the first URL found in `text` when `url` is
empty.** Android's share intent puts the link in `EXTRA_TEXT`, so Chrome
delivers it in `text`. §6.1 names this as the single most common cause of a
share target that silently does nothing.

**Nothing new in `components/`.** The route brings its own three files and
nothing else: the paste field is a plain `<form method="get" action="/import">`
around a `TextField` — no `"use client"`, no state, works with JavaScript
disabled. The Ricettario gains an «Importa» button beside «Nuova»:
one line, the same `Button`+`Link` pair used on every list screen.

## 7. Ingredients the catalogue does not have

Six of nine, on the measured recipe. Creating them one at a time is six taps
before a save is possible, on the path that has to be fastest — the user is
standing up with a phone.

**They are created when the recipe is saved, and marked before it.**
`IngredientRows` already holds the catalogue list; a row whose name is not in it
carries a quiet «nuovo». That is what makes the site's own typo — «pomodori
cliegino» — visible at the moment it can still be fixed, rather than three weeks
later in a shopping list.

**Consequence, approved explicitly:** `saveRecipe` creates a missing catalogue
entry (`altro`, no unit) instead of refusing, and `UnknownIngredientError` and
its message go away. That path guarded against something the interface cannot
produce — the picker makes you choose or create — and its outcome was losing the
save. One behaviour, in the service, rather than a second action beside the one
that exists.

## 8. The login callback

`proxy.ts` redirects a missing session to `/login` and discards the address.
Share a recipe with an expired session and you sign in, land on `/menu`, and the
link is gone.

It becomes `/login?next=<path>`, and `/login` passes it as `callbackURL`.
**`next` is accepted only when it is a relative path beginning with `/`** — an
unchecked `next` is an open redirect, and the login screen is the worst place in
the app to have one.

## 9. The manifest

```jsonc
"share_target": {
  "action": "/import",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

The comment in `app/manifest.ts` explaining why it is absent goes with it.

## 10. Testing

No network in tests (`docs/conventions/testing.md`).

- **The measured page, saved as a fixture.** It is a real case with the broken
  JSON already inside it, so it tests the tolerant read and the mapping together.
- `lib/json-ld.ts`: a control character inside a string; two blocks with one
  broken; `Recipe` inside `@graph`; `@type` as an array.
- `lib/duration.ts`: `PT25M`, `PT1H30M`, absent, malformed.
- The yield extractor: `"4 - 6 porzioni"`, `"4"`, `"per una teglia"`.
- `lib/url-guard.ts`: `file://`, `127.0.0.1`, `169.254.169.254`, a redirect from
  a public host to a private one.

Not tested: that `fetch` fetches, that Prisma writes, the shape of any third
party's markup beyond the fixture.

## 11. Files

New: `lib/json-ld.ts`, `lib/duration.ts`, `lib/url-guard.ts`,
`lib/services/import.ts`, `lib/schemas/import.ts`,
`app/(app)/import/{page,loading,error}.tsx`, and the fixture.

Changed: `app/manifest.ts`, `proxy.ts`, `app/login/page.tsx`,
`components/auth/google-sign-in.tsx`, `components/ingredients/ingredient-rows.tsx`,
`app/(app)/recipes/actions.ts`, `lib/services/recipes.ts`,
`app/(app)/recipes/page.tsx`.

Reused unchanged: `RecipeForm`, `PageForm`, `DetailBody`, `PageHeader`,
`DetailSkeleton`, `PageError`, `useFormState`, `RecipeInputSchema`,
`IngredientPicker`, and `lib/services/ingredient-parse.ts`.

## 12. Open, deliberately

- **The LLM fallback**, for pages with no JSON-LD. Revisit with a count of how
  often it is actually needed, taken from use.
- **A second entry from the shopping list or the menu.** Not until someone wants
  it.
