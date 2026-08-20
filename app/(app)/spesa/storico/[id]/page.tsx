import { notFound } from "next/navigation"

import { saveTotal } from "@/app/(app)/spesa/storico/actions"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { PurchaseTotalForm } from "@/components/shopping/purchase-total-form"
import { APP_TIMEZONE } from "@/lib/config"
import { formatEuro } from "@/lib/money"
import { PurchaseIdSchema } from "@/lib/schemas/shopping"
import { getPurchase } from "@/lib/services/purchases"
import { groupByAisle } from "@/lib/services/shopping-view"
import { amountOf } from "@/lib/units"

export const metadata = { title: "Spesa" }

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

// For the field, not for reading: "12,34" and not "12,34 €".
const forEditing = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",")

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: raw } = await params
  const parsed = PurchaseIdSchema.safeParse(raw)

  // An id that is not an id is not a purchase that exists — not an error to
  // report.
  if (!parsed.success) notFound()

  const purchase = await getPurchase(parsed.data)
  if (purchase === null) notFound()

  const groups = groupByAisle(purchase.lines)

  return (
    <DetailBody>
      <PageHeader
        title={dayFormat.format(purchase.purchasedAt)}
        back={{ href: "/spesa/storico", label: "Storico spesa" }}
      />

      <p className="text-sm text-muted-foreground">
        {purchase.totalCents === null
          ? "Importo non ancora inserito."
          : formatEuro(purchase.totalCents)}
      </p>

      <PurchaseTotalForm
        id={purchase.id}
        total={forEditing(purchase.totalCents)}
        action={saveTotal}
      />

      {/* The same five lines of markup as the shopping list's aisle sections.
          Two screens sharing them is not yet a component; if a third wants
          them, extract then. */}
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.aisle} className="flex flex-col gap-1">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.aisle}
            </h2>
            <ul className="flex flex-col">
              {group.lines.map((line) => {
                const amount = amountOf(line.quantity, line.unit)

                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-baseline gap-x-2 py-1 text-sm"
                  >
                    <span className="break-words">{line.name}</span>
                    {amount === null ? null : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {amount}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </DetailBody>
  )
}
