import Link from "next/link"

import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListSection } from "@/components/page/list-section"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

  const total = accounts.reduce(
    (sum, account) => sum + account.balanceCents,
    0
  )

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

      <ListSection title="Saldi" className="gap-2">
        {accounts.map((account) => (
          <li key={account.id}>
            <Card className="flex-row items-baseline justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium break-words">{account.name}</span>
                <span className="text-xs text-muted-foreground">
                  {account.lastMovementAt === null
                    ? "nessun movimento"
                    : `aggiornato al ${day.format(account.lastMovementAt)}`}
                </span>
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {formatEuro(account.balanceCents)}
              </span>
            </Card>
          </li>
        ))}

        <li className="flex items-baseline justify-between gap-3 px-4 pt-1">
          <span className="text-sm text-muted-foreground">Totale</span>
          <span className="font-semibold tabular-nums">
            {formatEuro(total)}
          </span>
        </li>
      </ListSection>

      {/* Not a number to admire: when it disagrees with what the provider's own
          app shows, an import has a hole. */}
      <p className="text-xs text-muted-foreground">
        Il saldo è il saldo iniziale più i movimenti importati. Se non torna con
        quello che vedi sull’app del servizio, manca qualcosa da importare.
      </p>

      <ListSection title="Vai a">
        {WAYS_IN.map((way) => (
          <DataListRow key={way.href} href={way.href} title={way.label} />
        ))}
      </ListSection>
    </ListBody>
  )
}
