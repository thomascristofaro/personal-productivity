import Link from "next/link"

import { cn } from "@/lib/utils"

export function FilterChips({
  basePath,
  param,
  chips,
  active,
  keep = {},
}: {
  basePath: string
  param: string
  chips: readonly { value: string | undefined; label: string }[]
  // The raw param, not the value it maps to: a value nobody offered should
  // highlight nothing, rather than highlight "Tutti" and imply the filter was
  // understood.
  active: string | undefined
  keep?: Record<string, string | undefined>
}) {
  const hrefFor = (value: string | undefined) => {
    const params = new URLSearchParams()
    if (value !== undefined) params.set(param, value)
    // The search survives the chip. Losing what you had typed because you
    // narrowed the type is the kind of small betrayal that stops people
    // filtering at all.
    for (const [key, kept] of Object.entries(keep)) {
      if (kept) params.set(key, kept)
    }
    const search = params.toString()
    return search === "" ? basePath : `${basePath}?${search}`
  }

  return (
    <nav aria-label="Filtra per tipo">
      {/* Links and not buttons, and therefore no "use client": the choice
          belongs in the address bar, so it survives a refresh and can be sent
          to the other phone. A client component here would buy nothing and
          pull the boundary up the tree. */}
      <ul className="flex gap-2">
        {chips.map((chip) => {
          const current = chip.value === active

          return (
            <li key={chip.label}>
              <Link
                href={hrefFor(chip.value)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-4xl border px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {chip.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
