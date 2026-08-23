import Link from "next/link"

import { ImportPanel } from "@/components/finance/import-panel"
import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { listAccounts } from "@/lib/services/finance/accounts"
import { listImports } from "@/lib/services/finance/import"

export const metadata = { title: "Importa" }

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})

export default async function FinanceImportPage() {
  const { userId } = await requireSession()
  const [accounts, imports] = await Promise.all([
    listAccounts(userId),
    listImports(userId),
  ])

  return (
    <ListBody>
      <PageHeader
        title="Importa"
        back={{ href: "/finance", label: "Finanza" }}
        subtitle="Carica l’estratto conto esportato dal servizio."
      />

      {accounts.length === 0 ? (
        // Importing into nothing is not a state worth designing a form for.
        <EmptyState
          title="Nessun conto."
          description="Aggiungi un conto prima di importare i movimenti."
        >
          <Button
            render={<Link href="/finance/accounts/new" />}
            nativeButton={false}
          >
            Nuovo conto
          </Button>
        </EmptyState>
      ) : (
        <ImportPanel
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
          }))}
        />
      )}

      {imports.length === 0 ? null : (
        <DetailSection title="Import recenti" className="gap-2">
          <CardList>
            {imports.map((batch) => (
              // No href: an import is a reading, not a way in. An anchor with
              // nowhere to go would be a keyboard stop that does nothing.
              <DataListRow
                key={batch.id}
                title={`${batch.accountName} — ${batch.fileName}`}
              >
                <span>{batch.rowsWritten} movimenti</span>
                <span>{batch.rowsSkipped} già presenti</span>
                <span>{day.format(batch.createdAt)}</span>
              </DataListRow>
            ))}
          </CardList>
        </DetailSection>
      )}
    </ListBody>
  )
}
