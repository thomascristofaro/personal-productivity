import { saveCategory } from "@/app/(app)/finance/categories/actions"
import { CategoryList } from "@/components/finance/category-list"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { requireSession } from "@/lib/auth"
import { listCategories } from "@/lib/services/finance/categories"

export const metadata = { title: "Categorie" }

export default async function CategoriesPage() {
  await requireSession()
  const categories = await listCategories()

  return (
    <ListBody>
      <PageHeader
        title="Categorie"
        back={{ href: "/finance/rules", label: "Regole" }}
        subtitle="Le parole con cui leggi le tue uscite."
      />

      <CategoryList categories={categories} action={saveCategory} />
    </ListBody>
  )
}
