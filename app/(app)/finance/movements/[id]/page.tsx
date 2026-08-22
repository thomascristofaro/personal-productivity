import { notFound } from "next/navigation"
import { cache } from "react"

import { saveMovementNote } from "@/app/(app)/finance/movements/[id]/actions"
import { MovementAmount } from "@/components/finance/movement-amount"
import { MovementNoteForm } from "@/components/finance/movement-note-form"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Separator } from "@/components/ui/separator"
import { requireSession } from "@/lib/auth"
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm break-words">{children}</span>
    </div>
  )
}

export default async function MovementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireSession()
  const movement = await movementOnce(userId, id)

  // Not found and not "not yours": telling somebody a row exists is already
  // telling them something.
  if (movement === null) notFound()

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

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Come è arrivato
        </h2>

        <Row label="Data">{longDay.format(movement.date)}</Row>
        <Row label="Importo">
          <MovementAmount cents={movement.amountCents} />
        </Row>
        <Row label="Conto">{movement.accountName}</Row>
        {movement.providerCategory === null ? null : (
          <Row label="Categoria dichiarata">{movement.providerCategory}</Row>
        )}
        {movement.importedAt === null ? null : (
          <Row label="Importato">
            {dayAndTime.format(movement.importedAt)}
            {movement.importFileName === null
              ? null
              : ` — ${movement.importFileName}`}
          </Row>
        )}

        <p className="pt-1 text-xs text-muted-foreground">
          Questi dati arrivano dal file e non si modificano: correggerli qui
          farebbe riscrivere l’originale al prossimo import dello stesso periodo.
        </p>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Le tue note
        </h2>

        <MovementNoteForm
          movementId={movement.id}
          note={movement.note ?? ""}
          action={saveMovementNote}
        />
      </section>
    </DetailBody>
  )
}
