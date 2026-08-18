import { saveCatalogItem } from "@/app/(app)/catalogo/actions"
import { CatalogForm } from "@/components/catalog/catalog-form"
import { PageHeader } from "@/components/page/page-header"
import { AISLE_ORDER, AISLE_UNKNOWN } from "@/lib/aisles"
import { listUsedUnits } from "@/lib/services/catalog"

export const metadata = { title: "Nuova voce" }

export default async function NewCatalogItemPage() {
  const units = await listUsedUnits()

  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title="Nuova voce"
        back={{ href: "/catalogo", label: "Catalogo" }}
      />
      <CatalogForm
        action={saveCatalogItem}
        aisles={AISLE_ORDER}
        units={units}
        values={{ name: "", defaultUnit: "", aisle: AISLE_UNKNOWN }}
      />
    </main>
  )
}
