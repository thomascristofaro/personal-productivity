import Link from "next/link"

import { cn } from "@/lib/utils"

const CHIPS = [
  { tipo: undefined, label: "Tutti" },
  { tipo: "ingredienti", label: "Ingredienti" },
  { tipo: "prodotti", label: "Prodotti" },
] as const

export function KindFilter({
  // The raw `?tipo=`, not the kind it maps to: a value nobody offered should
  // highlight nothing, rather than highlight "Tutti" and imply the filter was
  // understood.
  active,
  query,
}: {
  active: string | undefined
  query: string | undefined
}) {
  const hrefFor = (tipo: string | undefined) => {
    const params = new URLSearchParams()
    if (tipo !== undefined) params.set("tipo", tipo)
    // The search survives the chip. Losing what you had typed because you
    // narrowed the type is the kind of small betrayal that stops people
    // filtering at all.
    if (query) params.set("q", query)
    const search = params.toString()
    return search === "" ? "/catalogo" : `/catalogo?${search}`
  }

  return (
    <nav aria-label="Filtra per tipo">
      {/* Links and not buttons, and therefore no "use client": the choice
          belongs in the address bar, so it survives a refresh and can be sent
          to the other phone. A client component here would buy nothing and
          pull the boundary up the tree. */}
      <ul className="flex gap-2">
        {CHIPS.map((chip) => {
          const current = chip.tipo === active

          return (
            <li key={chip.label}>
              <Link
                href={hrefFor(chip.tipo)}
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
