import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import {
  saveMovementCategory,
  saveMovementNote,
  unlinkMovementTransfer,
} from "@/app/(app)/finance/movements/[id]/actions"
import { MovementAmount } from "@/components/finance/movement-amount"
import { MovementCategoryForm } from "@/components/finance/movement-category-form"
import { MovementNoteForm } from "@/components/finance/movement-note-form"
import { DataRow } from "@/components/page/data-row"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { requireSession } from "@/lib/auth"
import { listCategories } from "@/lib/services/finance/categories"
import { suggestPattern } from "@/lib/services/finance/categorise"
import { getMovement } from "@/lib/services/finance/movements"

// generateMetadata and the page both need the movement; React.cache collapses
// them into one query per request. The service cannot do this itself — the
// domain layer may not import React.
const movementOnce = cache(getMovement)

const longDay = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const dayAndTime = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireSession()
  const movement = await movementOnce(userId, id)
  return { title: movement?.description ?? "Movimento" }
}

export default async function MovementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireSession()
  const [movement, categories] = await Promise.all([
    movementOnce(userId, id),
    listCategories(),
  ])

  // Not found and not "not yours": telling somebody a row exists is already
  // telling them something.
  if (movement === null) notFound()

  const options = Object.fromEntries(
    categories
      .filter((category) => !category.archived || category.id === movement.categoryId)
      .map((category) => [category.id, category.name])
  )

  return (
    <DetailBody>
      <PageHeader
        title={movement.description}
        back={{ href: "/finance/movements", label: "Movimenti" }}
        subtitle={
          <>
            <span>{longDay.format(movement.date)}</span>
            <span>{movement.accountName}</span>
            <MovementAmount cents={movement.amountCents} />
          </>
        }
      />

      <Separator />

      <DetailSection title="Come è arrivato" className="gap-2">
        <DataRow label="Data">{longDay.format(movement.date)}</DataRow>
        <DataRow label="Importo">
          <MovementAmount cents={movement.amountCents} />
        </DataRow>
        <DataRow label="Conto">{movement.accountName}</DataRow>
        {movement.providerCategory === null ? null : (
          <DataRow label="Categoria dichiarata">
            {movement.providerCategory}
          </DataRow>
        )}
        {movement.importedAt === null ? null : (
          <DataRow label="Importato">
            {dayAndTime.format(movement.importedAt)}
            {movement.importFileName === null
              ? null
              : ` — ${movement.importFileName}`}
          </DataRow>
        )}

        <p className="pt-1 text-xs text-muted-foreground">
          Questi dati arrivano dal file e non si modificano: correggerli qui
          farebbe riscrivere l’originale al prossimo import dello stesso periodo.
        </p>
      </DetailSection>

      <Separator />

      <DetailSection title="Le tue decisioni" className="gap-4">
        <MovementCategoryForm
          movementId={movement.id}
          categoryId={movement.categoryId ?? ""}
          categories={options}
          suggestedPattern={suggestPattern(movement.description)}
          action={saveMovementCategory}
        />

        {movement.twin === null ? (
          <p className="text-sm text-muted-foreground">
            Nessun trasferimento collegato.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <DataRow label="Trasferimento">
              <Link
                href={`/finance/movements/${movement.twin.id}`}
                className="underline underline-offset-3"
              >
                {movement.twin.description} — {movement.twin.accountName}
              </Link>
            </DataRow>
            <form
              action={unlinkMovementTransfer.bind(null, movement.id)}
              className="self-start"
            >
              <Button type="submit" variant="ghost" size="sm">
                Scollega
              </Button>
            </form>
          </div>
        )}
      </DetailSection>

      <Separator />

      <DetailSection title="Le tue note" className="gap-3">
        <MovementNoteForm
          movementId={movement.id}
          note={movement.note ?? ""}
          action={saveMovementNote}
        />
      </DetailSection>
    </DetailBody>
  )
}
