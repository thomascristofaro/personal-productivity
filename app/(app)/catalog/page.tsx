import Link from "next/link"
import { Suspense } from "react"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { FilterChips } from "@/components/page/filter-chips"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { SearchField } from "@/components/page/search-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { countLabel } from "@/lib/count-label"
import { firstOf } from "@/lib/search-params"
import { kindFilterFor, listCatalogItems } from "@/lib/services/catalog"

export const metadata = { title: "Catalogo" }

const KIND_CHIPS = [
  { value: undefined, label: "Tutti" },
  { value: "ingredients", label: "Ingredienti" },
  { value: "products", label: "Prodotti" },
] as const

const FOUND = {
  none: "Nessuna voce trovata.",
  one: "voce trovata",
  many: "voci trovate",
}

export default async function CatalogPage({
  searchParams,
}: {
  // Next resolves a repeated param to a string array, not a string.
  searchParams: Promise<{ q?: string | string[]; kind?: string | string[] }>
}) {
  const { q: rawQuery, kind: rawKind } = await searchParams
  const q = firstOf(rawQuery)
  const kind = firstOf(rawKind)
  const isSearching = Boolean(q?.trim())
  const items = await listCatalogItems(q, kindFilterFor(kind))

  return (
    <ListBody>
      <PageHeader title="Catalogo">
        <Button render={<Link href="/catalog/new" />} nativeButton={false}>
          Nuova
        </Button>
      </PageHeader>

      <Suspense>
        <SearchField
          basePath="/catalog"
          placeholder="Cerca una voce…"
          label="Cerca una voce"
        />
      </Suspense>

      <FilterChips
        basePath="/catalog"
        param="kind"
        chips={KIND_CHIPS}
        active={kind}
        label="Filtra per tipo"
        keep={{ q }}
      />

      <DataList
        items={items}
        announcement={countLabel(items.length, FOUND)}
        renderItem={(item) => (
          <DataListRow
            key={item.name}
            href={`/catalog/${encodeURIComponent(item.name)}/edit`}
            title={item.name}
          >
            {/* No badge for the kind. It was there, first coloured and then
                neutral, and neither earned its place: the chips above filter to
                one kind in a tap, which is the question the badge was answering
                one row at a time. */}
            <Badge variant="secondary">{item.aisle}</Badge>
            {item.defaultUnit === null ? null : <span>{item.defaultUnit}</span>}
            <span>
              {item.usedIn === 0
                ? "non usato"
                : item.usedIn === 1
                  ? "1 ricetta"
                  : `${item.usedIn} ricette`}
            </span>
          </DataListRow>
        )}
        empty={
          isSearching ? (
            <EmptyState title="Nessuna voce con questo nome." />
          ) : kind !== undefined ? (
            // A third case, or filtering to a kind that has no entries reads as
            // an empty catalogue.
            <EmptyState title="Nessuna voce di questo tipo." />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto."
              description="Aggiungi la prima voce."
            >
              <Button
                render={<Link href="/catalog/new" />}
                nativeButton={false}
              >
                Nuova voce
              </Button>
            </EmptyState>
          )
        }
      />
    </ListBody>
  )
}
