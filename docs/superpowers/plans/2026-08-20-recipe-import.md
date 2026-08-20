# Recipe Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A link shared from Android, or pasted into the app, becomes a
pre-filled recipe form the user reviews and saves.

**Architecture:** A server component at `/import` reads the search params, calls
one service function that fetches the page behind an SSRF guard and maps its
`schema.org/Recipe` JSON-LD to a draft, and renders the existing `RecipeForm`
with the draft in it. No LLM in this version. No new component in `components/`.

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Zod 4, Prisma 7,
Vitest (node environment). Node's `fetch` and `node:dns/promises` for the
fetcher.

**Spec:** [`docs/superpowers/specs/2026-08-20-recipe-import-design.md`](../specs/2026-08-20-recipe-import-design.md)

## Global Constraints

Every task's requirements implicitly include all of these.

- **Reuse, do not copy.** The owner's instruction, 2026-08-20: no copy-pasted UI
  components or code. If a task's markup already exists as a primitive, use the
  primitive. Nothing new goes in `components/`.
- **Layering.** `lib/services/` may not import from `app/`, `components/`,
  `hooks/`, React or `next/*`, and may not touch `Request`, `Response`,
  `cookies()` or `headers()`. ESLint fails `pnpm verify` on a violation.
- **Zod validates every external input**, at the route handler and inside every
  server action.
- **Italian for what the user reads. English for identifiers, comments, TSDoc,
  test names, commit messages.**
- **Every exported function in `lib/services/` carries a TSDoc block**: one-line
  summary, `@param`, `@returns`, `@throws` if it throws. No types — TypeScript
  has those. ESLint enforces it; private helpers are exempt.
- **Comment only _why_.** A comment that restates the code is deleted.
- **`pnpm verify` must be green before any commit.** Run it; do not assume.
- **Format with `pnpm exec prettier --write <paths>`.** Never `pnpm format
<file>` — that script has a hardcoded glob and reformats the whole repository.
- **Run pnpm from PowerShell** prefixed with
  `$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'`.
- **Never commit to `main`.** This plan runs on `feat/recipe-import`.

---

### Task 1: ISO 8601 durations

The measured page publishes `prepTime: "PT25M"` and `cookTime: "PT15M"` and no
`totalTime`, so the two have to be read and added.

**Files:**

- Create: `lib/duration.ts`
- Test: `lib/duration.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `minutesFromDuration(value: unknown): number | null`

- [ ] **Step 1: Write the failing test**

`lib/duration.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { minutesFromDuration } from "@/lib/duration"

describe("minutesFromDuration", () => {
  it("reads the minutes a recipe site publishes", () => {
    expect(minutesFromDuration("PT25M")).toBe(25)
  })

  it("adds the hours", () => {
    expect(minutesFromDuration("PT1H30M")).toBe(90)
  })

  it("reads a duration written with a zero day part", () => {
    expect(minutesFromDuration("P0DT30M")).toBe(30)
  })

  it("returns null for a duration that adds up to nothing", () => {
    // "P" alone matches the shape and means no time at all. Zero minutes is
    // not a cooking time, and an empty field reads better than "0".
    expect(minutesFromDuration("P")).toBeNull()
  })

  it("returns null for anything that is not a duration", () => {
    expect(minutesFromDuration("mezz'ora")).toBeNull()
    expect(minutesFromDuration(undefined)).toBeNull()
    expect(minutesFromDuration(45)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'; pnpm exec vitest run lib/duration.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/duration"`.

- [ ] **Step 3: Write the implementation**

`lib/duration.ts`:

```ts
// Days, hours and minutes only. A cooking time measured in months is not a
// cooking time, and guessing at one would put a wrong number in a field the
// user then has to notice and correct.
const DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i

/**
 * The minutes in an ISO 8601 duration.
 *
 * `schema.org` publishes recipe times as `PT25M` or `PT1H30M`, and the value is
 * whatever the site chose to put there — it is not guaranteed to be a string.
 *
 * @param value - the duration, or anything else the page supplied
 * @returns the total minutes, or null when there is nothing to read
 */
export function minutesFromDuration(value: unknown): number | null {
  if (typeof value !== "string") return null

  const match = DURATION.exec(value.trim())
  if (match === null) return null

  const total =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)

  return total > 0 ? total : null
}
```

- [ ] **Step 4: Run the test and watch it pass**

```
pnpm exec vitest run lib/duration.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write lib/duration.ts lib/duration.test.ts
git add lib/duration.ts lib/duration.test.ts
git commit -m "feat: read the ISO 8601 durations recipe sites publish"
```

---

### Task 2: The tolerant JSON-LD reader

The fixture at `lib/__fixtures__/cucchiaio-insalata-di-riso.html` is already
committed. It is the real page the owner named, trimmed to its `<head>`, and its
`schema.org/Recipe` block **is not valid JSON**: raw newlines sit inside string
literals. `JSON.parse` refuses it. This task is the reason the import works on
that page at all.

**Files:**

- Create: `lib/json-ld.ts`
- Test: `lib/json-ld.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type JsonLdNode = Record<string, unknown>`
  - `readJsonLd(html: string): JsonLdNode[]`
  - `findRecipe(nodes: JsonLdNode[]): JsonLdNode | null`

- [ ] **Step 1: Write the failing test**

`lib/json-ld.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { findRecipe, readJsonLd } from "@/lib/json-ld"

const page = readFileSync(
  "lib/__fixtures__/cucchiaio-insalata-di-riso.html",
  "utf8"
)

const block = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head></html>`

describe("readJsonLd", () => {
  it("recovers a block that JSON.parse refuses", () => {
    // The captured page puts raw newlines inside string literals. A strict
    // reader finds nothing on the one page we know the users share.
    const nodes = readJsonLd(page)
    expect(findRecipe(nodes)).not.toBeNull()
  })

  it("keeps the good block when another one is unreadable", () => {
    const html =
      block("{ this is not json at all }") +
      block('{"@type":"Recipe","name":"Torta"}')
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("finds a recipe inside @graph", () => {
    const html = block(
      '{"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Torta"}]}'
    )
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("finds a recipe whose @type is an array", () => {
    const html = block('{"@type":["Thing","Recipe"],"name":"Torta"}')
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("returns null when the page publishes no recipe", () => {
    const html = block('{"@type":"WebPage","name":"Chi siamo"}')
    expect(findRecipe(readJsonLd(html))).toBeNull()
  })
})

describe("the captured page", () => {
  it("carries the fields the mapping needs", () => {
    const recipe = findRecipe(readJsonLd(page))
    expect(recipe?.name).toBe("Insalata di riso")
    expect(recipe?.recipeYield).toBe("4 - 6 porzioni")
    expect(recipe?.prepTime).toBe("PT25M")
    expect(recipe?.cookTime).toBe("PT15M")
    expect(recipe?.totalTime).toBeUndefined()
    expect(recipe?.recipeIngredient).toHaveLength(9)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```
pnpm exec vitest run lib/json-ld.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/json-ld"`.

- [ ] **Step 3: Write the implementation**

`lib/json-ld.ts`:

```ts
export type JsonLdNode = Record<string, unknown>

const BLOCK =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

// Real pages publish JSON-LD that JSON.parse refuses. The captured page at
// lib/__fixtures__/ puts raw newlines inside string literals, and it is the
// page the owners actually share — a strict reader would find nothing on it.
// Escaping only the control characters that sit inside a string literal is a
// repair narrow enough to be safe: outside a string they are whitespace, and
// JSON has no other meaning for them.
function escapeControlsInStrings(text: string): string {
  let out = ""
  let inString = false
  let escaped = false

  for (const character of text) {
    if (escaped) {
      out += character
      escaped = false
      continue
    }
    if (character === "\\") {
      out += character
      escaped = true
      continue
    }
    if (character === '"') {
      inString = !inString
      out += character
      continue
    }
    if (inString && character === "\n") {
      out += "\\n"
      continue
    }
    if (inString && character === "\r") {
      out += "\\r"
      continue
    }
    if (inString && character === "\t") {
      out += "\\t"
      continue
    }
    out += character
  }

  return out
}

function collect(value: unknown, into: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into)
    return
  }
  if (value === null || typeof value !== "object") return

  const node = value as JsonLdNode
  into.push(node)

  // Sites built on Yoast and its imitators put every real node under @graph and
  // leave nothing at the top level.
  if (Array.isArray(node["@graph"])) collect(node["@graph"], into)
}

/**
 * Every JSON-LD object a page publishes, flattened.
 *
 * @param html - the page's markup
 * @returns the nodes, in the order the page declares them; empty when there are
 *   none or none can be read
 */
export function readJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = []

  for (const match of html.matchAll(BLOCK)) {
    let parsed: unknown

    try {
      parsed = JSON.parse(match[1])
    } catch {
      try {
        parsed = JSON.parse(escapeControlsInStrings(match[1]))
      } catch {
        // One unreadable block must not cost a page the others it published.
        continue
      }
    }

    collect(parsed, nodes)
  }

  return nodes
}

/**
 * The schema.org Recipe among a page's JSON-LD nodes.
 *
 * @param nodes - what `readJsonLd` returned
 * @returns the first Recipe node, or null when the page declares none
 */
export function findRecipe(nodes: JsonLdNode[]): JsonLdNode | null {
  return (
    nodes.find((node) => {
      const type = node["@type"]
      if (typeof type === "string") return type === "Recipe"
      return Array.isArray(type) && type.includes("Recipe")
    }) ?? null
  )
}
```

- [ ] **Step 4: Run the test and watch it pass**

```
pnpm exec vitest run lib/json-ld.test.ts
```

Expected: PASS, 6 tests. If the last one fails on a field name, read the fixture
rather than changing the expectation — the fixture is the ground truth.

- [ ] **Step 5: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write lib/json-ld.ts lib/json-ld.test.ts
git add lib/json-ld.ts lib/json-ld.test.ts
git commit -m "feat: read JSON-LD that real sites publish, broken JSON included"
```

---

### Task 3: The SSRF guard and the guarded fetch

Required by §9.3 of the main design document. This is the one module in the
feature where a mistake is a security bug, so the address test is exhaustive and
the redirect re-validation is tested with both globals stubbed.

**Files:**

- Create: `lib/url-guard.ts`
- Test: `lib/url-guard.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `class BlockedUrlError extends Error`
  - `isPrivateAddress(address: string): boolean`
  - `fetchPublicPage(rawUrl: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

`lib/url-guard.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  BlockedUrlError,
  fetchPublicPage,
  isPrivateAddress,
} from "@/lib/url-guard"

// Hoisted above the import by Vitest, so the module under test sees the stub.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "public.example") return [{ address: "93.184.216.34" }]
    if (hostname === "internal.example") return [{ address: "10.0.0.5" }]
    throw new Error(`unexpected lookup: ${hostname}`)
  }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and multicast", () => {
    for (const address of [
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "239.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }
  })

  it("blocks an IPv4 address wearing an IPv6 coat", () => {
    // ::ffff:169.254.169.254 reaches the cloud metadata endpoint just as well
    // as the dotted form does.
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true)
  })

  it("allows a public address", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false)
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false)
  })

  it("blocks anything that is not an address", () => {
    expect(isPrivateAddress("not-an-address")).toBe(true)
  })
})

describe("fetchPublicPage", () => {
  it("refuses a scheme that is not http or https", async () => {
    await expect(fetchPublicPage("file:///etc/passwd")).rejects.toBeInstanceOf(
      BlockedUrlError
    )
  })

  it("refuses a host that resolves to a private address", async () => {
    await expect(
      fetchPublicPage("https://internal.example/page")
    ).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it("refuses a public host that redirects to a private one", async () => {
    // The reason redirects are followed by hand: a host that passes the check
    // and then sends us to 10.0.0.5 is exactly the attack the guard exists for.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://internal.example/secret" },
          })
      )
    )

    await expect(
      fetchPublicPage("https://public.example/page")
    ).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it("returns the body of a page it is allowed to read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>ciao</html>", { status: 200 }))
    )

    await expect(fetchPublicPage("https://public.example/page")).resolves.toBe(
      "<html>ciao</html>"
    )
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```
pnpm exec vitest run lib/url-guard.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/url-guard"`.

- [ ] **Step 3: Write the implementation**

`lib/url-guard.ts`:

```ts
import { Buffer } from "node:buffer"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_REDIRECTS = 3
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000

// Some sites answer a bare client with a challenge page. Naming a real browser
// is not evasion — it is asking for the page a person would have been served.
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlockedUrlError"
  }
}

/**
 * Whether an IP address is one this application must not fetch from.
 *
 * Anything unrecognised counts as private. A guard that fails open is not a
 * guard, and the cost of a false refusal here is one page not importing.
 *
 * @param address - a dotted-quad or IPv6 address
 * @returns true when the address is private, loopback, link-local, reserved, or
 *   not an address at all
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)

  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    // Carrier-grade NAT, and everything from multicast upward.
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }

  if (version === 6) {
    const normalised = address.toLowerCase()
    if (normalised === "::1" || normalised === "::") return true
    // fc00::/7 unique-local, fe80::/10 link-local.
    if (/^f[cd]/.test(normalised)) return true
    if (normalised.startsWith("fe80")) return true

    // ::ffff:10.0.0.1 reaches the same host the dotted form does.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised)
    if (mapped !== null) return isPrivateAddress(mapped[1])

    return false
  }

  return true
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`scheme ${url.protocol} is not allowed`)
  }

  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true })

  if (addresses.length === 0) {
    throw new BlockedUrlError(`${host} does not resolve`)
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedUrlError(`${host} resolves to a private address`)
    }
  }
}

async function readCapped(response: Response): Promise<string> {
  if (response.body === null) return ""

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    size += value.byteLength
    // Stop rather than read on: a response that keeps arriving is not a page we
    // want, and the cap is what keeps it out of the function's memory.
    if (size > MAX_BYTES) {
      await reader.cancel()
      break
    }

    chunks.push(value)
  }

  return new TextDecoder("utf-8").decode(Buffer.concat(chunks))
}

/**
 * Fetches a page the user asked us to read, refusing what a fetcher must not
 * reach.
 *
 * Redirects are followed by hand so every hop is checked: a public host that
 * answers 302 to 169.254.169.254 is the whole reason this exists. The body is
 * never returned to a client — only the draft mapped from it leaves the server.
 *
 * @param rawUrl - the address, already validated as a URL by the caller
 * @returns the page's markup
 * @throws BlockedUrlError when the scheme, the host or the redirect chain is
 *   refused, or the upstream answers an error status
 */
export async function fetchPublicPage(rawUrl: string): Promise<string> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError("not a URL")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublic(url)

      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (location === null) {
          throw new BlockedUrlError("redirect without a location")
        }
        url = new URL(location, url)
        continue
      }

      if (!response.ok) {
        throw new BlockedUrlError(`upstream answered ${response.status}`)
      }

      return await readCapped(response)
    }

    throw new BlockedUrlError("too many redirects")
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```
pnpm exec vitest run lib/url-guard.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write lib/url-guard.ts lib/url-guard.test.ts
git add lib/url-guard.ts lib/url-guard.test.ts
git commit -m "feat: the fetcher refuses the addresses a fetcher must not reach"
```

---

### Task 4: The import service

**Files:**

- Create: `lib/schemas/import.ts`
- Create: `lib/services/import.ts`
- Test: `lib/services/import.test.ts`

**Interfaces:**

- Consumes: `minutesFromDuration` (Task 1), `readJsonLd` / `findRecipe` (Task 2),
  `fetchPublicPage` (Task 3), and the existing
  `parseIngredientLine(raw: string): { raw: string; quantity: number | null; unit: string | null; name: string }`
  from `@/lib/services/ingredient-parse`.
- Produces:
  - `ImportUrlSchema` (Zod)
  - `type DraftIngredient = { ingredientName: string; unit: string | null; quantity: number | null }`
  - `type RecipeDraft = { title: string; sourceUrl: string; servings: number | null; totalMinutes: number | null; instructions: string; ingredients: DraftIngredient[] }`
  - `draftFromHtml(html: string, sourceUrl: string): RecipeDraft | null`
  - `importRecipeFromUrl(url: string): Promise<RecipeDraft | null>`

- [ ] **Step 1: Write the failing test**

`lib/services/import.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { draftFromHtml } from "@/lib/services/import"

const page = readFileSync(
  "lib/__fixtures__/cucchiaio-insalata-di-riso.html",
  "utf8"
)
const SOURCE = "https://www.cucchiaio.it/ricetta/ricetta-insalata-riso/"

describe("draftFromHtml", () => {
  it("maps the captured page", () => {
    const draft = draftFromHtml(page, SOURCE)

    expect(draft).not.toBeNull()
    expect(draft?.title).toBe("Insalata di riso")
    expect(draft?.sourceUrl).toBe(SOURCE)
    // "4 - 6 porzioni": the first number, because the confirmation screen is
    // where a range gets settled.
    expect(draft?.servings).toBe(4)
    // No totalTime on this page — prepTime plus cookTime.
    expect(draft?.totalMinutes).toBe(40)
    expect(draft?.instructions).toContain("lessate il riso")
    expect(draft?.ingredients).toHaveLength(9)
  })

  it("parses the ingredient lines with the parser we already have", () => {
    const draft = draftFromHtml(page, SOURCE)

    expect(draft?.ingredients[0]).toEqual({
      ingredientName: "riso",
      unit: "g",
      quantity: 300,
    })
    // A line with no quantity is the "q.b." case and stays that way.
    expect(draft?.ingredients[5]).toEqual({
      ingredientName: "prezzemolo",
      unit: null,
      quantity: null,
    })
  })

  it("returns null for a page with no recipe in it", () => {
    expect(draftFromHtml("<html><body>ciao</body></html>", SOURCE)).toBeNull()
  })

  it("drops a servings count the recipe schema would refuse", () => {
    // Pre-filling a value that cannot be saved teaches the user that the form
    // is broken. RecipeInputSchema caps servings at 50.
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Torta","recipeYield":"per 400 persone",
       "recipeIngredient":["1 uovo"]}
    </script></head></html>`
    expect(draftFromHtml(html, SOURCE)?.servings).toBeNull()
  })

  it("leaves servings empty when the yield names no number", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Torta","recipeYield":"per una teglia",
       "recipeIngredient":["1 uovo"]}
    </script></head></html>`
    expect(draftFromHtml(html, SOURCE)?.servings).toBeNull()
  })

  it("prefers totalTime when the page publishes one", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Recipe","name":"Torta","totalTime":"PT1H",
       "prepTime":"PT10M","cookTime":"PT5M","recipeIngredient":["1 uovo"]}
    </script></head></html>`
    expect(draftFromHtml(html, SOURCE)?.totalMinutes).toBe(60)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```
pnpm exec vitest run lib/services/import.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/services/import"`.

- [ ] **Step 3: Write the schema**

`lib/schemas/import.ts`:

```ts
import { z } from "zod"

// The same rule RecipeInputSchema applies to a recipe's own sourceUrl: z.url()
// alone accepts any scheme, javascript: included.
export const ImportUrlSchema = z
  .url("L’indirizzo deve essere un URL valido.")
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "L’indirizzo deve iniziare con http:// o https://",
  })
```

- [ ] **Step 4: Write the service**

`lib/services/import.ts`:

```ts
import { minutesFromDuration } from "@/lib/duration"
import { findRecipe, type JsonLdNode, readJsonLd } from "@/lib/json-ld"
import {
  RECIPE_TITLE_MAX,
  SERVINGS_MAX,
  TOTAL_MINUTES_MAX,
} from "@/lib/schemas/recipe"
import { parseIngredientLine } from "@/lib/services/ingredient-parse"
import { fetchPublicPage } from "@/lib/url-guard"

const MAX_INGREDIENTS = 100

export type DraftIngredient = {
  ingredientName: string
  unit: string | null
  quantity: number | null
}

export type RecipeDraft = {
  title: string
  sourceUrl: string
  servings: number | null
  totalMinutes: number | null
  instructions: string
  ingredients: DraftIngredient[]
}

// A JSON-LD value is whatever the site put there: a string, an array of them,
// or an object with a `text`. HowToStep is the last of those.
function textOf(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value.map(textOf).filter(Boolean).join(" ")
  }
  if (value !== null && typeof value === "object") {
    const text = (value as Record<string, unknown>).text
    return typeof text === "string" ? text : ""
  }
  return ""
}

// "4 - 6 porzioni" is a range, and the first number is the one the recipe is
// written for. The confirmation screen exists to change it.
function firstNumber(value: unknown): number | null {
  const match = /\d+/.exec(textOf(value))
  return match === null ? null : Number(match[0])
}

// A value the recipe schema would refuse must not be pre-filled: a form that
// opens holding something it will not save reads as broken.
function withinRange(value: number | null, max: number): number | null {
  if (value === null) return null
  return value >= 1 && value <= max ? value : null
}

function instructionsOf(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (!Array.isArray(value)) return ""

  return value
    .map((step) => textOf(step).trim())
    .filter((step) => step !== "")
    .join("\n\n")
}

function ingredientsOf(node: JsonLdNode): DraftIngredient[] {
  const lines = node.recipeIngredient
  if (!Array.isArray(lines)) return []

  return lines
    .filter((line): line is string => typeof line === "string")
    .slice(0, MAX_INGREDIENTS)
    .map((line) => parseIngredientLine(line))
    .filter((parsed) => parsed.name !== "")
    .map((parsed) => ({
      ingredientName: parsed.name,
      unit: parsed.unit,
      quantity: parsed.quantity,
    }))
}

/**
 * Maps a page's markup to a recipe draft.
 *
 * Separate from the fetch so it can be tested against a captured page rather
 * than a live site.
 *
 * @param html - the page's markup
 * @param sourceUrl - the address it came from, kept for the recipe's Fonte
 * @returns the draft, or null when the page published no readable recipe
 */
export function draftFromHtml(
  html: string,
  sourceUrl: string
): RecipeDraft | null {
  const recipe = findRecipe(readJsonLd(html))
  if (recipe === null) return null

  const title = textOf(recipe.name).trim().slice(0, RECIPE_TITLE_MAX)
  if (title === "") return null

  const total =
    minutesFromDuration(recipe.totalTime) ??
    (minutesFromDuration(recipe.prepTime) ?? 0) +
      (minutesFromDuration(recipe.cookTime) ?? 0)

  return {
    title,
    sourceUrl,
    servings: withinRange(firstNumber(recipe.recipeYield), SERVINGS_MAX),
    totalMinutes: withinRange(total, TOTAL_MINUTES_MAX),
    instructions: instructionsOf(recipe.recipeInstructions),
    ingredients: ingredientsOf(recipe),
  }
}

/**
 * Reads a recipe from the page at a URL.
 *
 * @param url - the address, already validated with ImportUrlSchema
 * @returns the draft, or null when the page cannot be read or holds no recipe
 */
export async function importRecipeFromUrl(
  url: string
): Promise<RecipeDraft | null> {
  // A site that refuses us, times out or answers rubbish is an ordinary outcome
  // with a screen behind it, not a fault worth an error boundary.
  try {
    return draftFromHtml(await fetchPublicPage(url), url)
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Export the two caps the service needs**

`lib/schemas/recipe.ts` already declares `RECIPE_TITLE_MAX`. Add the two the
service reads, and use them in the schema itself so the numbers cannot drift:

```ts
export const SERVINGS_MAX = 50
export const TOTAL_MINUTES_MAX = 2880
```

Then replace the literals in `servings` and `totalMinutes` with these constants,
keeping the messages exactly as they are.

- [ ] **Step 6: Run the test and watch it pass**

```
pnpm exec vitest run lib/services/import.test.ts
```

Expected: PASS, 6 tests. If the ingredient assertions fail, print what
`parseIngredientLine` actually returned and fix the expectation to match the
parser — the parser is already tested and is not what this task changes.

- [ ] **Step 7: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write lib/schemas/import.ts lib/schemas/recipe.ts lib/services/import.ts lib/services/import.test.ts
git add lib/schemas/import.ts lib/schemas/recipe.ts lib/services/import.ts lib/services/import.test.ts
git commit -m "feat: a shared page becomes a recipe draft"
```

---

### Task 5: A save creates the catalogue entries it needs

Six of the measured recipe's nine ingredients are not in the catalogue, and
`createRecipe` currently refuses the save. This is what makes an import savable
in one tap.

**Files:**

- Modify: `lib/services/recipes.ts`
- Modify: `app/(app)/recipes/actions.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `createRecipe` and `updateRecipe` no longer throw
  `UnknownIngredientError`; the class and its import are gone.

- [ ] **Step 1: Add the helper**

In `lib/services/recipes.ts`, above `createRecipe`:

```ts
// Creates whatever the recipe names and the catalogue lacks, so a save is never
// refused over a name the user has already decided to use. `altro` and no unit
// is what every new entry starts as — /catalogo is where it gets corrected, and
// the recipe form marks the new ones before the save so a site's typo can be
// caught first. skipDuplicates rather than read-then-write: two saves landing
// together must not race each other into a unique violation.
async function ensureIngredients(input: RecipeInput): Promise<void> {
  const names = [...new Set(input.ingredients.map((row) => row.ingredientName))]
  if (names.length === 0) return

  await db.catalogItem.createMany({
    data: names.map((name) => ({ name, kind: "INGREDIENT" as const })),
    skipDuplicates: true,
  })
}
```

- [ ] **Step 2: Call it, and delete the error it replaces**

In `createRecipe`, `await ensureIngredients(input)` as the first statement inside
the function, before the `try`. Same in `updateRecipe`. Then remove from
`lib/services/recipes.ts`:

- the `UnknownIngredientError` class
- both `if (isForeignKeyError(error)) throw new UnknownIngredientError()` lines
- the `@throws UnknownIngredientError` lines from both TSDoc blocks
- `isForeignKeyError` itself, if nothing else uses it — check with a grep before
  deleting

And in `app/(app)/recipes/actions.ts`, remove the `UnknownIngredientError`
import, the `missingIngredient` constant, and both `if (error instanceof
UnknownIngredientError) return missingIngredient` lines.

- [ ] **Step 3: Prove the behaviour by hand**

There is no test for this: `docs/conventions/testing.md` keeps Prisma out of the
suite, and the value here is the database round trip. Verify it in Task 8's
browser pass instead, where the same action runs behind a real import.

- [ ] **Step 4: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write lib/services/recipes.ts "app/(app)/recipes/actions.ts"
git add lib/services/recipes.ts "app/(app)/recipes/actions.ts"
git commit -m "refactor: a save creates the catalogue entries the recipe names"
```

---

### Task 6: The `/import` screen

**Files:**

- Create: `app/(app)/import/page.tsx`
- Create: `app/(app)/import/loading.tsx`
- Create: `app/(app)/import/error.tsx`
- Modify: `app/(app)/recipes/page.tsx`

**Interfaces:**

- Consumes: `importRecipeFromUrl`, `RecipeDraft` (Task 4), `ImportUrlSchema`
  (Task 4), and the existing `RecipeForm`, `DetailBody`, `PageHeader`,
  `TextField`, `Button`, `DetailSkeleton`, `PageError`,
  `firstOf` from `@/lib/search-params`.
- Produces: the route. Nothing imports it.

- [ ] **Step 1: The two three-line files**

`app/(app)/import/error.tsx`:

```tsx
"use client"

// Next requires an error boundary file to be a client component, and requires
// it per segment. There is nothing per-segment to say.
export { PageError as default } from "@/components/page/page-error"
```

`app/(app)/import/loading.tsx`:

```tsx
import { DetailSkeleton } from "@/components/page/detail-skeleton"

export default function Loading() {
  return <DetailSkeleton label="Leggo la pagina…" />
}
```

- [ ] **Step 2: The page**

`app/(app)/import/page.tsx`:

```tsx
import { addIngredient, saveRecipe } from "@/app/(app)/recipes/actions"
import { TextField } from "@/components/page/fields"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { Button } from "@/components/ui/button"
import { ImportUrlSchema } from "@/lib/schemas/import"
import { firstOf } from "@/lib/search-params"
import { listIngredientOptions, listUsedUnits } from "@/lib/services/catalog"
import { importRecipeFromUrl, type RecipeDraft } from "@/lib/services/import"
import { listTags } from "@/lib/services/recipes"

export const metadata = { title: "Importa una ricetta" }

// Android's share intent carries the link in EXTRA_TEXT, so Chrome delivers it
// in `text` and leaves `url` empty. Reading `url` alone is the single most
// common cause of a share target that silently does nothing — design §6.1.
function sharedLink(url: string | undefined, text: string | undefined) {
  if (url !== undefined && url.trim() !== "") return url.trim()
  const match = /https?:\/\/\S+/i.exec(text ?? "")
  return match === null ? null : match[0]
}

const empty = (sourceUrl: string) => ({
  title: "",
  sourceUrl,
  servings: "",
  totalMinutes: "",
  instructions: "",
  notes: "",
  tags: [],
  ingredients: [],
})

const filled = (draft: RecipeDraft) => ({
  title: draft.title,
  sourceUrl: draft.sourceUrl,
  servings: draft.servings === null ? "" : String(draft.servings),
  totalMinutes: draft.totalMinutes === null ? "" : String(draft.totalMinutes),
  instructions: draft.instructions,
  notes: "",
  tags: [],
  ingredients: draft.ingredients.map((row, index) => ({
    key: `row-${index}`,
    ingredientName: row.ingredientName,
    unit: row.unit ?? "",
    quantity: row.quantity === null ? "" : String(row.quantity),
  })),
})

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    url?: string | string[]
    text?: string | string[]
  }>
}) {
  const params = await searchParams
  const link = sharedLink(firstOf(params.url), firstOf(params.text))

  // Narrowed into a plain string before the ternary, because `parsed?.success`
  // does not narrow `parsed.data` through an optional chain.
  const parsed = link === null ? null : ImportUrlSchema.safeParse(link)
  const target = parsed !== null && parsed.success ? parsed.data : null

  // In parallel: awaiting them in sequence is the waterfall the React
  // guidelines rank CRITICAL. The import is one of them, and it is the slow one.
  const [draft, options, units, tagSuggestions] = await Promise.all([
    target === null ? null : importRecipeFromUrl(target),
    listIngredientOptions(),
    listUsedUnits(),
    listTags(),
  ])

  if (link === null) {
    return (
      <DetailBody>
        <PageHeader
          title="Importa una ricetta"
          back={{ href: "/recipes", label: "Ricettario" }}
          subtitle="Incolla il link di una ricetta e la leggo per te."
        />

        {/* A plain GET form: no "use client", no state, and it works with
            JavaScript off. Submitting navigates to this same page with the
            link in the query, which is the path the share sheet takes too. */}
        <form action="/import" method="get" className="flex flex-col gap-6">
          <TextField
            id="url"
            name="url"
            label="Link della ricetta"
            type="url"
            inputMode="url"
            placeholder="https://…"
            spellCheck={false}
            autoComplete="off"
            required
          />
          <Button type="submit" className="w-fit">
            Leggi
          </Button>
        </form>
      </DetailBody>
    )
  }

  return (
    <DetailBody>
      <PageHeader
        title="Importa una ricetta"
        back={{ href: "/recipes", label: "Ricettario" }}
        subtitle={
          draft === null
            ? "Non sono riuscito a leggere questa pagina. Compilala a mano."
            : "Controlla quello che ho letto, poi salva."
        }
      />

      <RecipeForm
        action={saveRecipe}
        options={options}
        units={units}
        tagSuggestions={tagSuggestions}
        onCreateIngredient={addIngredient}
        // `target` and not `link`: a share that carried something which is not
        // an http(s) URL must not pre-fill Fonte with a value the recipe schema
        // will then refuse. Same reason `withinRange` drops an impossible
        // servings count.
        values={draft === null ? empty(target ?? "") : filled(draft)}
      />
    </DetailBody>
  )
}
```

- [ ] **Step 3: The way in from the Ricettario**

In `app/(app)/recipes/page.tsx`, inside `<PageHeader title="Ricettario">`, before
the existing «Nuova» button:

```tsx
<Button variant="outline" render={<Link href="/import" />} nativeButton={false}>
  Importa
</Button>
```

- [ ] **Step 4: Verify and build**

```
pnpm verify
pnpm build
```

`pnpm verify` cannot prove the `error.tsx` re-export — `tsc` and `eslint` do not
resolve route conventions. `next build` can, and must show `/import` in the
route list.

- [ ] **Step 5: Format and commit**

```
pnpm exec prettier --write "app/(app)/import/page.tsx" "app/(app)/import/loading.tsx" "app/(app)/import/error.tsx" "app/(app)/recipes/page.tsx"
git add "app/(app)/import" "app/(app)/recipes/page.tsx"
git commit -m "feat: the import screen, and the way into it from the ricettario"
```

---

### Task 7: The new ingredients are marked

**Files:**

- Modify: `components/ingredients/ingredient-rows.tsx`

**Interfaces:**

- Consumes: the `options: IngredientOption[]` prop the component already
  receives.
- Produces: nothing other components read.

- [ ] **Step 1: Compute the set once**

Inside `IngredientRows`, beside the existing `const names = options.map(...)`:

```tsx
// The catalogue as a set, so marking a row is a lookup and not a scan of 113
// entries per keystroke.
const known = new Set(names)
```

- [ ] **Step 2: Mark the row**

Inside the row's `map`, in the picker's own wrapper — the
`<div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">` — immediately
after the hidden `ingredientName` input and before that div closes:

```tsx
{
  row.ingredientName !== "" && !known.has(row.ingredientName) ? (
    // An import brings names the catalogue does not have — six of the
    // nine on the page this feature was measured against. Saying so
    // here is what lets a site's own typo be caught before the save
    // creates it.
    <span className="mt-1 block text-xs text-muted-foreground">nuovo</span>
  ) : null
}
```

Inside that wrapper and not beside it: the row is a `flex flex-wrap` of four
controls, and a fifth child would take a slot in that layout at 390px.

- [ ] **Step 3: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write components/ingredients/ingredient-rows.tsx
git add components/ingredients/ingredient-rows.tsx
git commit -m "feat: a row whose ingredient the catalogue lacks says so"
```

---

### Task 8: Browser checklist

No automated test covers a share target, a live fetch or a Prisma write. This is
where the feature is actually proven. Run the dev server at 390 px.

```
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'app\.asar' }) -join ';'; if (Test-Path .next) { Remove-Item -Recurse -Force .next }; pnpm dev
```

- [ ] **Step 1: The paste path, end to end**

Open `/import`. The field is there, the header reads «Importa una ricetta», the
back link goes to the Ricettario. Paste
`https://www.cucchiaio.it/ricetta/ricetta-insalata-riso/` and submit.

Expect: the form fills — «Insalata di riso», 4 porzioni, 40 minuti, nine
ingredient rows with «300 g riso» in the first, the preparation in the textarea,
the link in Fonte. Six rows carry «nuovo».

- [ ] **Step 2: The save**

Press Salva. Expect a redirect to the saved recipe. Then open `/catalogo` and
confirm the six new entries exist, in `altro`, with no unit. This is the only
proof Task 5 works.

- [ ] **Step 3: The failure path**

Open `/import?url=https://example.com`. Expect the empty form, the link already
in Fonte, and the subtitle «Non sono riuscito a leggere questa pagina. Compilala
a mano.» Nothing throws; the error boundary does not appear.

- [ ] **Step 4: The share-sheet parameter shape**

Open `/import?text=Guarda%20questa%20https://www.cucchiaio.it/ricetta/ricetta-insalata-riso/`
with **no `url` parameter**. Expect the same filled form as Step 1 — this is the
Chrome behaviour §6.1 warns about, and it is the one that fails silently in
production if it is wrong.

- [ ] **Step 5: A refused link**

Open `/import?url=http://127.0.0.1:3000`. Expect the empty form and the failure
subtitle, not a stack trace and not a hang.

- [ ] **Step 6: Console**

Zero errors across all five. Record any finding in the commit message; do not
fix it silently.

- [ ] **Step 7: Commit the checklist result**

```
git commit --allow-empty -m "test: browser checklist for the import, at 390px"
```

Write what was observed in the body, including anything that did not behave as
this plan expected.

---

### Task 9: The login callback

**Files:**

- Modify: `proxy.ts`
- Modify: `app/login/page.tsx`
- Modify: `components/auth/google-sign-in.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `GoogleSignIn` takes `callbackURL: string`.

- [ ] **Step 1: Carry the address through the redirect**

In `proxy.ts`, replace the final redirect:

```ts
// Without this the shared link dies at the login screen: you sign in, land on
// /menu, and the recipe you were importing is gone.
const next = request.nextUrl.pathname + request.nextUrl.search
const login = new URL("/login", request.url)
login.searchParams.set("next", next)
return NextResponse.redirect(login)
```

- [ ] **Step 2: Accept it only when it is safe**

In `lib/safe-next.ts`:

```ts
/**
 * Where to send a user after they sign in.
 *
 * Only a relative path of our own is accepted. An unchecked `next` is an open
 * redirect, and a login screen is the worst place in an application to have
 * one — `//evil.example` and `https://evil.example` are both absolute, and the
 * first one looks relative.
 *
 * @param next - whatever arrived in the query string
 * @returns the path to return to, or /menu when there is nothing safe to use
 */
export function safeNext(next: string | undefined): string {
  if (next === undefined) return "/menu"
  if (!next.startsWith("/") || next.startsWith("//")) return "/menu"
  return next
}
```

In `app/login/page.tsx`, widen the `searchParams` type to
`{ negato?: string; next?: string }`, read `next`, and render
`<GoogleSignIn callbackURL={safeNext(next)} />`.

- [ ] **Step 3: Take the prop**

In `components/auth/google-sign-in.tsx`, add `callbackURL: string` to the props
and use it in place of the hardcoded `"/menu"`.

- [ ] **Step 4: Prove the guard**

`safeNext` lives in a new `lib/safe-next.ts`, not in the page, so a node test can
import it without pulling a React server component in. `app/login/page.tsx`
imports it from there. The test is `lib/safe-next.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { safeNext } from "@/lib/safe-next"

describe("safeNext", () => {
  it("keeps a relative path of ours", () => {
    expect(safeNext("/import?url=https://x.example")).toBe(
      "/import?url=https://x.example"
    )
  })

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.example")).toBe("/menu")
  })

  it("refuses a protocol-relative URL that looks relative", () => {
    expect(safeNext("//evil.example")).toBe("/menu")
  })

  it("falls back when there is nothing to go back to", () => {
    expect(safeNext(undefined)).toBe("/menu")
  })
})
```

- [ ] **Step 5: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write proxy.ts app/login/page.tsx components/auth/google-sign-in.tsx lib/safe-next.ts lib/safe-next.test.ts
git add proxy.ts app/login/page.tsx components/auth/google-sign-in.tsx lib/safe-next.ts lib/safe-next.test.ts
git commit -m "fix: a shared link no longer dies at the login screen"
```

---

### Task 10: The manifest, and the documents

**Files:**

- Modify: `app/manifest.ts`
- Modify: `docs/conventions/ui.md`
- Modify: `docs/roadmap.md`

**Interfaces:**

- Consumes: the `/import` route existing (Task 6).
- Produces: nothing.

- [ ] **Step 1: Declare the share target**

In `app/manifest.ts`, delete the comment explaining why `share_target` is absent
and add it after `start_url`:

```ts
    // Android's share intent puts the link in EXTRA_TEXT, so Chrome delivers it
    // in `text` and leaves `url` empty. /import reads both — see the import
    // design document §6.
    share_target: {
      action: "/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
```

If `MetadataRoute.Manifest` does not type `share_target` in this Next version,
check `node_modules/next/dist/lib/metadata/types/manifest-types.d.ts` before
reaching for a cast, and say in the commit message what you found.

- [ ] **Step 2: Build, and check the served manifest**

```
pnpm build
pnpm dev
```

Fetch `http://localhost:3000/manifest.webmanifest` and confirm `share_target` is
in the JSON with all three params.

- [ ] **Step 3: The documents**

**`docs/conventions/ui.md` is not touched.** This feature adds no primitive, no
new pattern and nothing to `components/` — a section describing one route would
be the kind of changelog entry that document was just cleaned of.

In `docs/roadmap.md`, move the import out of "In flight" into the shipped table,
with one line saying what it left behind and one naming what comes next. It is
the only file that records state; leaving it wrong is the mistake this branch
has already had to fix twice.

- [ ] **Step 4: Verify, format and commit**

```
pnpm verify
pnpm exec prettier --write app/manifest.ts docs/roadmap.md
git add app/manifest.ts docs/roadmap.md
git commit -m "feat: the app appears in Android's share sheet"
```

---

## Owner actions

Collect these for the closing report; none of them is a task.

- **Install the PWA** on both phones from Chrome, then share a recipe from
  cucchiaio.it. Nothing before this proves the share sheet, and nothing in this
  plan can.
- **Nothing to configure.** No new environment variable, no API key: v1 has no
  LLM.
