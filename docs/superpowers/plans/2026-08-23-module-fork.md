# Module Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make «which module am I in» a first-class idea in the shell — one
registry declares a module, the navigation reads it, and `/` becomes a fork
between modules instead of a hardcoded redirect to the menu.

**Architecture:** a pure registry in `lib/modules.ts` holds each module's label,
destination and navigation entries, plus the two decisions that read it — what
`/` should do, and how the nav panel groups itself. The registry is pure data and
pure functions, so it is testable in the `node` environment this repository runs
tests in; the components become thin renderers of what it returns.

**Tech Stack:** Next.js App Router, React server components, Base UI through
shadcn, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-23-finance-design.md`](../specs/2026-08-23-finance-design.md) §2.

## Global Constraints

- **Italian for what the user reads**, English for identifiers, comments, file
  names, commit messages, test names. `CLAUDE.md` § Language.
- **URL segments are English.** The fork lives at `/`, the finance module at
  `/finance`.
- **Server components by default.** `"use client"` only where interactivity
  requires it. `components/app-nav.tsx` is already a client component and stays
  one; the new page is a server component.
- **No component library other than shadcn/ui.** `Card` and `Button` come from
  `components/ui/`.
- **`lib/services/` may not be imported from here and imports nothing from
  `app/` or `components/`.** `lib/modules.ts` is not a service: it is pure data
  with no database access, and it may be imported by both server and client
  components.
- **Tests run in `environment: "node"`** (`vitest.config.ts`). There are no
  React component tests in this repository and this plan does not add the first
  one. Everything asserted here is a pure function.
- **Run `pnpm verify` before claiming anything works.**
- Commit messages in English, and end with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## A note on the dead branch

The registry ships in this plan holding **one** module, because the finance
module does not exist yet. `/` therefore redirects to `/menu` exactly as it does
today, and the fork's two-block rendering is written but never reached until the
next plan adds the second registry entry.

This is deliberate and it is the point of the plan: the seam is built and
tested now, and turning it on is one entry in one file. Do not "simplify" it by
deleting the fork branch.

---

### Task 1: The module registry and the two decisions it answers

**Files:**

- Create: `lib/modules.ts`
- Create: `lib/modules.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type NavItem = { href: string; label: string }`
  - `type AppModule = { id: string; label: string; description: string; href: string; nav: readonly NavItem[] }`
  - `type NavGroup = { title: string | null; items: readonly NavItem[] }`
  - `const MODULES: readonly AppModule[]`
  - `soleModule(modules: readonly AppModule[]): AppModule | null`
  - `navGroupsFor(modules: readonly AppModule[], isOwner: boolean): readonly NavGroup[]`
  - `activeHrefIn(items: readonly NavItem[], pathname: string): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `lib/modules.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  activeHrefIn,
  MODULES,
  navGroupsFor,
  soleModule,
  type AppModule,
} from "@/lib/modules"

const menu: AppModule = {
  id: "menu",
  label: "Menù e spesa",
  description: "Il menù della settimana e la lista della spesa.",
  href: "/menu",
  nav: [
    { href: "/menu", label: "Menù" },
    { href: "/shopping", label: "Spesa" },
  ],
}

const finance: AppModule = {
  id: "finance",
  label: "Finanza",
  description: "I movimenti dei conti, in un posto solo.",
  href: "/finance",
  nav: [
    { href: "/finance", label: "Riepilogo" },
    { href: "/finance/movements", label: "Movimenti" },
  ],
}

describe("MODULES", () => {
  it("declares the menu module first", () => {
    expect(MODULES[0]?.id).toBe("menu")
  })

  it("gives every module a distinct id", () => {
    const ids = MODULES.map((module) => module.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("soleModule", () => {
  it("returns the module when there is exactly one", () => {
    expect(soleModule([menu])).toBe(menu)
  })

  it("returns null when there are two", () => {
    expect(soleModule([menu, finance])).toBeNull()
  })

  it("returns null when there are none", () => {
    expect(soleModule([])).toBeNull()
  })
})

describe("navGroupsFor", () => {
  it("leaves one module untitled, so the panel keeps saying Menu", () => {
    expect(navGroupsFor([menu], false)).toEqual([
      { title: null, items: menu.nav },
    ])
  })

  it("appends the owner entry to the single group", () => {
    const [group] = navGroupsFor([menu], true)
    expect(group?.title).toBeNull()
    expect(group?.items.at(-1)).toEqual({
      href: "/settings/llm",
      label: "Impostazioni",
    })
  })

  it("titles the groups by module once there are two", () => {
    expect(navGroupsFor([menu, finance], false)).toEqual([
      { title: "Menù e spesa", items: menu.nav },
      { title: "Finanza", items: finance.nav },
    ])
  })

  it("gives the owner entry its own group once the groups are titled", () => {
    const groups = navGroupsFor([menu, finance], true)
    expect(groups.at(-1)).toEqual({
      title: "App",
      items: [{ href: "/settings/llm", label: "Impostazioni" }],
    })
  })
})

describe("activeHrefIn", () => {
  const items = [
    { href: "/finance", label: "Riepilogo" },
    { href: "/finance/movements", label: "Movimenti" },
  ]

  it("matches the entry exactly", () => {
    expect(activeHrefIn(items, "/finance")).toBe("/finance")
  })

  it("matches a descendant of an entry", () => {
    expect(activeHrefIn(items, "/finance/movements/abc")).toBe(
      "/finance/movements"
    )
  })

  it("picks the longest match, not every ancestor", () => {
    expect(activeHrefIn(items, "/finance/movements")).toBe("/finance/movements")
  })

  it("does not match a sibling whose href is a string prefix", () => {
    expect(activeHrefIn(items, "/financial")).toBeUndefined()
  })

  it("returns undefined when nothing matches", () => {
    expect(activeHrefIn(items, "/menu")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/modules.test.ts`
Expected: FAIL — the module `@/lib/modules` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `lib/modules.ts`:

```ts
export type NavItem = { href: string; label: string }

export type AppModule = {
  id: string
  label: string
  // The one-line subtitle under the block on the fork.
  description: string
  // Where the block leads, and where `/` redirects while this is the only one.
  href: string
  nav: readonly NavItem[]
}

export type NavGroup = { title: string | null; items: readonly NavItem[] }

// Adding a module to the app is one entry here: the fork, the navigation and
// what `/` does all read this list. The order is the one the two users think
// in, not alphabetical.
export const MODULES: readonly AppModule[] = [
  {
    id: "menu",
    label: "Menù e spesa",
    description: "Il menù della settimana, la spesa e le ricette.",
    href: "/menu",
    nav: [
      { href: "/menu", label: "Menù" },
      { href: "/shopping", label: "Spesa" },
      { href: "/recipes", label: "Ricettario" },
      { href: "/catalog", label: "Catalogo" },
    ],
  },
]

// Appended only for the owner. Hiding a link is not access control — every page
// and action under /settings calls requireOwner — it only stops the partner
// finding a door that would refuse her.
const OWNER_ITEMS: readonly NavItem[] = [
  { href: "/settings/llm", label: "Impostazioni" },
]

/**
 * The module to go straight to, when going straight there is the right thing.
 *
 * @param modules - the modules this user can see
 * @returns the only module, or null when a choice has to be offered
 */
export function soleModule(
  modules: readonly AppModule[]
): AppModule | null {
  return modules.length === 1 ? (modules[0] ?? null) : null
}

/**
 * The navigation panel's sections.
 *
 * @param modules - the modules this user can see
 * @param isOwner - whether to include the owner-only entries
 * @returns groups in the order they are rendered; a null title means the panel
 *   keeps its own caption instead of naming the group
 */
export function navGroupsFor(
  modules: readonly AppModule[],
  isOwner: boolean
): readonly NavGroup[] {
  // One module needs no headings: naming the only group would put a second
  // caption under the panel's own, which says the same thing twice.
  if (modules.length <= 1) {
    const items = modules.flatMap((module) => module.nav)
    return [{ title: null, items: isOwner ? [...items, ...OWNER_ITEMS] : items }]
  }

  const groups = modules.map((module) => ({
    title: module.label,
    items: module.nav,
  }))

  // "App" and not "Impostazioni": a group whose heading repeats its only entry
  // reads as a mistake. The settings are app-wide, which is what the heading
  // says.
  return isOwner ? [...groups, { title: "App", items: OWNER_ITEMS }] : groups
}

/**
 * Which navigation entry the current path belongs to.
 *
 * @param items - every entry on screen, across all groups
 * @param pathname - the current path
 * @returns the href to mark as the current page, or undefined
 */
export function activeHrefIn(
  items: readonly NavItem[],
  pathname: string
): string | undefined {
  // The longest matching href, not every matching one: a plain prefix test
  // lights every ancestor, and then `aria-current="page"` stops meaning "this
  // page". The trailing slash is what keeps /finance off /financial.
  return items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/modules.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/modules.ts lib/modules.test.ts
git commit -m "feat: a module is one entry in one list

The nav had its own copy of the four hrefs and `/` had a hardcoded
redirect, so adding a second module meant editing three places that
did not know about each other. The registry is the one place, and the
two decisions that read it — where `/` goes, how the panel groups
itself — are pure functions with tests, which the components that used
to hold them could not be.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The navigation reads the registry

**Files:**

- Modify: `components/app-nav.tsx` — replace `NAV_ITEMS`, `OWNER_ITEMS` and the
  inline `activeHref` computation with the registry, and render groups
- Modify: `app/(app)/layout.tsx:30-33` — pass the visible modules to `AppNav`

**Interfaces:**

- Consumes: `MODULES`, `navGroupsFor`, `activeHrefIn`, `type AppModule` from Task 1.
- Produces: `AppNav` now takes `modules: readonly AppModule[]` alongside
  `userName` and `isOwner`.

- [ ] **Step 1: Rewrite the constants and the computation in `components/app-nav.tsx`**

Delete lines 20-34 (the `NAV_ITEMS` and `OWNER_ITEMS` blocks with their
comments — both moved to `lib/modules.ts` in Task 1) and add to the imports:

```tsx
import {
  activeHrefIn,
  navGroupsFor,
  type AppModule,
} from "@/lib/modules"
```

- [ ] **Step 2: Widen the props and compute the groups**

Replace the component's signature and the two lines that follow it:

```tsx
// The name and the modules arrive as props: this is a client component, so it
// can neither read the session nor ask the database which accounts exist. The
// layout above it does both.
export function AppNav({
  userName,
  modules,
  isOwner = false,
}: {
  userName: string
  modules: readonly AppModule[]
  isOwner?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const groups = navGroupsFor(modules, isOwner)
  const activeHref = activeHrefIn(
    groups.flatMap((group) => group.items),
    pathname
  )
```

- [ ] **Step 3: Render the groups**

Replace the `<div>` at lines 101-129 — the one holding `<p>Menu</p>` and the
single `<ul>` — with one block per group. The `<nav>` wrapper, its
`className="flex flex-col gap-8 px-6 py-10"`, and the Account block below it are
untouched:

```tsx
          {groups.map((group, index) => (
            <div key={group.title ?? index}>
              <p className="pb-4 text-xs text-muted-foreground">
                {group.title ?? "Menu"}
              </p>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const isActive = item.href === activeHref

                  return (
                    <li key={item.href}>
                      <SheetClose
                        render={<Link href={item.href} />}
                        // A link is not a button, and Base UI wants to be told:
                        // without this it warns and applies button semantics to
                        // an anchor.
                        nativeButton={false}
                        // isActive only styles. Without this the highlight
                        // exists for the eye and for nothing else.
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-md py-2 text-3xl font-medium tracking-tight transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {item.label}
                      </SheetClose>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
```

- [ ] **Step 4: Pass the modules from the layout**

In `app/(app)/layout.tsx`, add the import:

```tsx
import { MODULES } from "@/lib/modules"
```

and widen the `AppNav` call:

```tsx
      <AppNav
        userName={user?.name ?? ""}
        modules={MODULES}
        isOwner={user !== null && isOwner(user.email)}
      />
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean. A failure naming `NAV_ITEMS` means Step 1's deletion was
partial.

- [ ] **Step 6: Commit**

```bash
git add components/app-nav.tsx app/\(app\)/layout.tsx
git commit -m "refactor: the panel renders groups it is given, not a list it owns

Same four entries and the same caption on screen. The panel no longer
knows which they are, which is what lets a second module add its own
without touching this file again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `/` becomes a fork inside the shell

**Files:**

- Create: `app/(app)/page.tsx`
- Delete: `app/page.tsx`

**Interfaces:**

- Consumes: `MODULES`, `soleModule` from Task 1.
- Produces: the route `/`, rendered inside the `(app)` layout.

Today `app/page.tsx` is a bare `redirect("/menu")` and sits **outside** the
`(app)` route group, so it never renders inside the shell. The fork needs the
shell. Both files cannot exist at once — they resolve to the same route and Next
fails the build — so the deletion is part of this task, not a tidy-up after it.

- [ ] **Step 1: Delete the old entry point**

```bash
git rm app/page.tsx
```

- [ ] **Step 2: Create the fork**

Create `app/(app)/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"

import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Card } from "@/components/ui/card"
import { MODULES, soleModule } from "@/lib/modules"

export const metadata = { title: "Home" }

export default function HomePage() {
  const modules = MODULES

  // One module is not a choice. Offering it as one would make everyone tap
  // through an extra screen to reach the only place they can go.
  const only = soleModule(modules)
  if (only !== null) redirect(only.href)

  return (
    <ListBody>
      <PageHeader title="Cosa apriamo?" />

      <ul className="flex flex-col gap-3">
        {modules.map((module) => (
          <li key={module.id}>
            <Card className="p-0">
              <Link
                href={module.href}
                className="flex min-h-24 flex-col justify-center gap-1 px-5 py-4"
              >
                <span className="text-xl font-semibold">{module.label}</span>
                <span className="text-sm text-muted-foreground">
                  {module.description}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </ListBody>
  )
}
```

No new component in `components/page/`. Two cards on one screen is not a
primitive; it becomes one if a third module ever needs the same shape.

- [ ] **Step 3: Verify the whole gate**

Run: `pnpm verify`
Expected: typecheck, lint and tests all clean.

- [ ] **Step 4: Check it in a browser**

Run `pnpm dev`, sign in, and visit `/`. Expected: you land on `/menu`, as before
— one module, so the fork does not appear. The address bar shows `/menu`.

- [ ] **Step 5: Check the fork branch renders, then undo the check**

Temporarily append a second entry to `MODULES` in `lib/modules.ts`:

```ts
  {
    id: "scratch",
    label: "Prova",
    description: "Un secondo modulo, solo per vedere il bivio.",
    href: "/menu",
    nav: [{ href: "/menu", label: "Prova" }],
  },
```

Visit `/` and confirm: two blocks, and the panel now shows two headings —
«Menù e spesa» and «Prova» — instead of «Menu». Then **remove the entry** and
confirm `/` redirects again.

This is the only way to see the branch before the next plan turns it on. Do not
commit the temporary entry.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/page.tsx
git commit -m "feat: the home is a fork, and takes the shortcut while there is one way to go

`/` moves inside the (app) group so it renders in the shell, and asks
the registry what to do: one module and it redirects there, more than
one and it offers the choice. Nothing changes on screen today — the
second module is what this is for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Manual checklist

The standing decision is that no plan ends in a browser test, so it ends in a
list. Walk it by hand or drive it through the `playwright` MCP server, at 390 px.

1. Signed in, `/` lands on `/menu`. The address bar reads `/menu`.
2. The panel opens from the hamburger and shows the caption «Menu» above four
   entries: Menù, Spesa, Ricettario, Catalogo. Unchanged from before.
3. Signed in as the owner, a fifth entry «Impostazioni» follows them in the same
   list, under the same caption.
4. On `/shopping`, «Spesa» is the highlighted entry and it carries
   `aria-current="page"`. On `/shopping/history`, still «Spesa».
5. Tapping an entry closes the panel and navigates.
6. The panel's caption, entries and the Account block have not moved or changed
   size.
7. `/` while signed out still redirects to `/login`, from the layout's gate.

## What this plan does not do

- **No roadmap update.** `docs/roadmap.md` has an unmerged correction on
  `fix/execution-history-foreign-key`; editing it here would collide with that
  branch at merge time. The roadmap is updated once that branch lands.
- **No finance route, no `FinanceAccount`, no visibility rule.** §3 of the spec
  is the next plan's, and until it exists the registry holds one module.
