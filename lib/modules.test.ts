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

  it("declares the finance module", () => {
    expect(MODULES.map((module) => module.id)).toContain("finance")
  })

  it("gives every module a distinct id", () => {
    const ids = MODULES.map((module) => module.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("keeps the import page out of the finance navigation", () => {
    // Reached from the button on /finance/movements and from the summary, and
    // from nowhere else: it is a thing you do to the movements, not a section.
    const finance = MODULES.find((entry) => entry.id === "finance")
    expect(finance?.nav.map((item) => item.href)).not.toContain(
      "/finance/import"
    )
  })

  it("sends the fork somewhere for every module", () => {
    // `entry` and not `module`: a `const module` is a Next lint error, because
    // assigning that name breaks the bundler's module wrapper.
    for (const entry of MODULES) {
      expect(entry.href.startsWith("/")).toBe(true)
      expect(entry.nav.length).toBeGreaterThan(0)
    }
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
