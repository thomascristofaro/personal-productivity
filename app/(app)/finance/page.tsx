import Link from "next/link"

import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { DataRow } from "@/components/page/data-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { formatEuro } from "@/lib/money"
import { listAccounts } from "@/lib/services/finance/accounts"

export const metadata = { title: "Finanza" }

// The month, the categories and the comparison with the last three months are
// the next plan's — design document §9.1. What is here is what this one can
// honestly show: what each account holds, and the three ways in.
const WAYS_IN = [
  { href: "/finance/movements", label: "Movimenti" },
  { href: "/finance/import", label: "Importa" },
  { href: "/finance/accounts", label: "Conti" },
] as const

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
})

export default async function FinancePage() {
  const { userId } = await requireSession()
  const accounts = await listAccounts(userId)

  const total = accounts.reduce((sum, account) => sum + account.balanceCents, 0)

  if (accounts.length === 0) {
    return (
      <ListBody>
        <PageHeader title="Finanza" />
        <EmptyState
          title="Nessun conto."
          description="Aggiungi il primo conto, poi importa l’estratto che il servizio esporta."
        >
          <Button
            render={<Link href="/finance/accounts/new" />}
            nativeButton={false}
          >
            Nuovo conto
          </Button>
        </EmptyState>
      </ListBody>
    )
  }

  return (
    <ListBody>
      <PageHeader title="Finanza" />

      <DetailSection title="Saldi" className="gap-2">
        <CardList>
          {accounts.map((account) => (
            // The tile leads to that account's movements, which is the question
            // a balance makes you ask next.
            <DataListRow
              key={account.id}
              href={`/finance/movements?account=${account.id}`}
              title={account.name}
            >
              <span className="font-medium text-foreground tabular-nums">
                {formatEuro(account.balanceCents)}
              </span>
              <span>
                {account.lastMovementAt === null
                  ? "nessun movimento"
                  : `aggiornato al ${day.format(account.lastMovementAt)}`}
              </span>
            </DataListRow>
          ))}
        </CardList>

        <div className="px-4 pt-1">
          <DataRow label="Totale">
            <span className="font-semibold tabular-nums">
              {formatEuro(total)}
            </span>
          </DataRow>
        </div>
      </DetailSection>

      {/* Not a number to admire: when it disagrees with what the provider's own
          app shows, an import has a hole. */}
      <p className="text-xs text-muted-foreground">
        Il saldo è il saldo iniziale più i movimenti importati. Se non torna con
        quello che vedi sull’app del servizio, manca qualcosa da importare.
      </p>

      <DetailSection title="Vai a" className="gap-2">
        <CardList>
          {WAYS_IN.map((way) => (
            <DataListRow key={way.href} href={way.href} title={way.label} />
          ))}
        </CardList>
      </DetailSection>
    </ListBody>
  )
}
