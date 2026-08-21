import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { APP_TIMEZONE } from "@/lib/config"
import { countLabel } from "@/lib/count-label"
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

const RECORDED = {
  none: "Nessuna spesa registrata.",
  one: "spesa registrata",
  many: "spese registrate",
}

export default async function PurchaseHistoryPage() {
  const purchases = await listPurchases()

  return (
    <ListBody>
      <PageHeader title="Storico spesa" />

      <DataList
        items={purchases}
        announcement={countLabel(purchases.length, RECORDED)}
        renderItem={(purchase) => (
          <DataListRow
            key={purchase.id}
            href={`/shopping/history/${purchase.id}`}
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
