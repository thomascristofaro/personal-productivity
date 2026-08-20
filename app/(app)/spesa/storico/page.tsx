import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { APP_TIMEZONE } from "@/lib/config"
import { formatEuro } from "@/lib/money"
import { listPurchases } from "@/lib/services/purchases"

export const metadata = { title: "Storico spesa" }

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

const weekFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

function announce(count: number) {
  if (count === 0) return "Nessuna spesa registrata."
  return count === 1 ? "1 spesa registrata." : `${count} spese registrate.`
}

export default async function PurchaseHistoryPage() {
  const purchases = await listPurchases()

  return (
    <ListBody>
      <PageHeader title="Storico spesa" />

      <DataList
        items={purchases}
        announcement={announce(purchases.length)}
        renderItem={(purchase) => (
          <DataListRow
            key={purchase.id}
            href={`/spesa/storico/${purchase.id}`}
            title={dayFormat.format(purchase.purchasedAt)}
          >
            {/* A badge and not a blank: a blank reads as free. */}
            {purchase.totalCents === null ? (
              <Badge variant="secondary">totale da inserire</Badge>
            ) : (
              <span className="tabular-nums">
                {formatEuro(purchase.totalCents)}
              </span>
            )}
            <span>
              {purchase.itemCount === 1
                ? "1 articolo"
                : `${purchase.itemCount} articoli`}
            </span>
            <span>settimana del {weekFormat.format(purchase.weekStart)}</span>
          </DataListRow>
        )}
        empty={
          <EmptyState
            title="Nessuna spesa registrata."
            description="Quando spunti gli articoli e premi «Spesa completata», la spesa finisce qui."
          />
        }
      />
    </ListBody>
  )
}
