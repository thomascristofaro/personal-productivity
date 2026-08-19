import Link from "next/link"

import { KindFilter } from "@/components/catalog/kind-filter"
import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { kindFilterFor, listCatalogItems } from "@/lib/services/catalog"

export const metadata = { title: "Catalogo" }

function announce(count: number) {
  if (count === 0) return "Nessuna voce trovata."
  return count === 1 ? "1 voce trovata." : `${count} voci trovate.`
}

export default async function CatalogPage({
  searchParams,
}: {
  // Next resolves a repeated param to a string array, not a string.
  searchParams: Promise<{ q?: string | string[]; tipo?: string | string[] }>
}) {
  const { q: rawQuery, tipo: rawTipo } = await searchParams
  const q = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery
  const tipo = Array.isArray(rawTipo) ? rawTipo[0] : rawTipo
  const isSearching = Boolean(q?.trim())
  const items = await listCatalogItems(q, kindFilterFor(tipo))

  return (
    <main className="flex flex-col gap-4 pt-6">
      <PageHeader title="Catalogo">
        <Button render={<Link href="/catalogo/new" />} nativeButton={false}>
          Nuova
        </Button>
      </PageHeader>

      <KindFilter active={tipo} query={q} />

      <DataList
        items={items}
        announcement={announce(items.length)}
        renderItem={(item) => (
          <DataListRow
            key={item.name}
            href={`/catalogo/${encodeURIComponent(item.name)}/edit`}
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
          ) : tipo !== undefined ? (
            // A third case, or filtering to a kind that has no entries reads as
            // an empty catalogue.
            <EmptyState title="Nessuna voce di questo tipo." />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto."
              description="Aggiungi la prima voce."
            >
              <Button
                render={<Link href="/catalogo/new" />}
                nativeButton={false}
              >
                Nuova voce
              </Button>
            </EmptyState>
          )
        }
      />
    </main>
  )
}
