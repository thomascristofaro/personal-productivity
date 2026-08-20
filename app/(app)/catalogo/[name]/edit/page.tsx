import { notFound } from "next/navigation"

import {
  removeCatalogItem,
  saveCatalogItem,
} from "@/app/(app)/catalogo/actions"
import { CatalogForm } from "@/components/catalog/catalog-form"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { AISLE_ORDER } from "@/lib/aisles"
import { getCatalogItem, listUsedUnits } from "@/lib/services/catalog"

export const metadata = { title: "Modifica voce" }

export default async function EditCatalogItemPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  // Next decodes the segment, so this is the plain name again.
  const { name } = await params
  const [item, units] = await Promise.all([
    getCatalogItem(name),
    listUsedUnits(),
  ])

  if (item === null) notFound()

  return (
    <DetailBody>
      <PageHeader
        title="Modifica voce"
        back={{ href: "/catalogo", label: "Catalogo" }}
      />

      <CatalogForm
        action={saveCatalogItem}
        aisles={AISLE_ORDER}
        units={units}
        values={{
          originalName: item.name,
          name: item.name,
          kind: item.kind,
          defaultUnit: item.defaultUnit ?? "",
          aisle: item.aisle,
        }}
      />

      {item.usedIn === 0 ? (
        <form action={removeCatalogItem.bind(null, item.name)}>
          <Button type="submit" variant="destructive">
            Elimina
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Non si può eliminare: è usato in{" "}
          {item.usedIn === 1 ? "1 ricetta" : `${item.usedIn} ricette`}.
        </p>
      )}
    </DetailBody>
  )
}
