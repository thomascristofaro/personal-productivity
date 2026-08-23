import Link from "next/link"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { countLabel } from "@/lib/count-label"
import { formatEuro } from "@/lib/money"
import { FINANCE_PROVIDER_LABELS } from "@/lib/schemas/finance"
import { listAccounts } from "@/lib/services/finance/accounts"

export const metadata = { title: "Conti" }

const FOUND = {
  none: "Nessun conto.",
  one: "conto",
  many: "conti",
}

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

export default async function FinanceAccountsPage() {
  const { userId } = await requireSession()
  const accounts = await listAccounts(userId)

  return (
    <ListBody>
      <PageHeader title="Conti" back={{ href: "/finance", label: "Finanza" }}>
        <Button
          render={<Link href="/finance/accounts/new" />}
          nativeButton={false}
        >
          Nuovo
        </Button>
      </PageHeader>

      <DataList
        items={accounts}
        announcement={countLabel(accounts.length, FOUND)}
        renderItem={(account) => (
          <DataListRow
            key={account.id}
            href={`/finance/accounts/${account.id}/edit`}
            title={account.name}
          >
            <Badge variant="secondary">
              {FINANCE_PROVIDER_LABELS[account.provider]}
            </Badge>
            <span>{formatEuro(account.balanceCents)}</span>
            {account.shared ? <span>condiviso</span> : null}
            {/* The fastest way to notice an account nobody has imported since
                June, which is what makes its balance quietly wrong. */}
            <span>
              {account.lastMovementAt === null
                ? "nessun movimento"
                : `ultimo movimento: ${day.format(account.lastMovementAt)}`}
            </span>
          </DataListRow>
        )}
        empty={
          <EmptyState
            title="Nessun conto."
            description="Aggiungi il primo conto per cominciare a importare i movimenti."
          >
            <Button
              render={<Link href="/finance/accounts/new" />}
              nativeButton={false}
            >
              Nuovo conto
            </Button>
          </EmptyState>
        }
      />
    </ListBody>
  )
}
