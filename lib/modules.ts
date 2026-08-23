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
  // Visible to everyone, and not only to whoever already owns an account: the
  // one place to create the first account is inside the module, so hiding it
  // until one exists locks everybody out on day one. Which accounts a person
  // then sees is decided per account, in lib/services/finance/access.ts, which
  // is where the privacy actually is.
  {
    id: "finance",
    label: "Finanza",
    description: "I movimenti dei conti, in un posto solo.",
    href: "/finance",
    nav: [
      { href: "/finance", label: "Riepilogo" },
      { href: "/finance/movements", label: "Movimenti" },
      { href: "/finance/import", label: "Importa" },
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
export function soleModule(modules: readonly AppModule[]): AppModule | null {
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
