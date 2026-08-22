import Link from "next/link"

import { ImportPanel } from "@/components/finance/import-panel"
import { EmptyState } from "@/components/page/empty-state"
import { ListSection } from "@/components/page/list-section"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
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
        <ListSection title="Import recenti">
          {imports.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-col gap-0.5 border-b py-3 last:border-b-0"
            >
              <span className="text-sm font-medium break-words">
                {batch.accountName} — {batch.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {batch.rowsWritten} movimenti, {batch.rowsSkipped} già presenti
                — {day.format(batch.createdAt)}
              </span>
            </li>
          ))}
        </ListSection>
      )}
    </ListBody>
  )
}
