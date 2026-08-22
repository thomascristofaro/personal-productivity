import Link from "next/link"
import { Suspense } from "react"

import { MovementAmount } from "@/components/finance/movement-amount"
import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { FilterChips } from "@/components/page/filter-chips"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { SearchField } from "@/components/page/search-field"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { countLabel } from "@/lib/count-label"
import { firstOf } from "@/lib/search-params"
import { listAccounts } from "@/lib/services/finance/accounts"
import { listMovements, offsetFrom } from "@/lib/services/finance/movements"

export const metadata = { title: "Movimenti" }

const FOUND = {
  none: "Nessun movimento trovato.",
  one: "movimento trovato",
  many: "movimenti trovati",
}

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
})

export default async function MovementsPage({
  searchParams,
}: {
  // Next resolves a repeated param to a string array, not a string.
  searchParams: Promise<{
    q?: string | string[]
    account?: string | string[]
    offset?: string | string[]
  }>
}) {
  const {
    q: rawQuery,
    account: rawAccount,
    offset: rawOffset,
  } = await searchParams
  const q = firstOf(rawQuery)
  const account = firstOf(rawAccount)
  const offset = offsetFrom(firstOf(rawOffset))

  const { userId } = await requireSession()
  const [accounts, page] = await Promise.all([
    listAccounts(userId),
    listMovements(userId, { accountId: account, q }, offset),
  ])

  const isSearching = Boolean(q?.trim())

  // At most four accounts, so the single row FilterChips renders still fits a
  // 390px screen. The horizontal scroll the design asks for belongs to the
  // category filter, which is the next plan's.
  const chips = [
    { value: undefined, label: "Tutti" },
    ...accounts.map((one) => ({ value: one.id, label: one.name })),
  ]

  const more = new URLSearchParams()
  if (q) more.set("q", q)
  if (account) more.set("account", account)
  more.set("offset", String(page.nextOffset))

  return (
    <ListBody>
      <PageHeader title="Movimenti" back={{ href: "/finance", label: "Finanza" }}>
        <Button
          variant="outline"
          render={<Link href="/finance/import" />}
          nativeButton={false}
        >
          Importa
        </Button>
      </PageHeader>

      <Suspense>
        <SearchField
          basePath="/finance/movements"
          placeholder="Cerca un movimento…"
          label="Cerca un movimento"
        />
      </Suspense>

      <FilterChips
        basePath="/finance/movements"
        param="account"
        chips={chips}
        active={account}
        label="Filtra per conto"
        keep={{ q }}
      />

      <DataList
        items={page.rows}
        announcement={countLabel(page.rows.length, FOUND)}
        renderItem={(movement) => (
          <DataListRow
            key={movement.id}
            href={`/finance/movements/${movement.id}`}
            title={movement.description}
          >
            <span>{day.format(movement.date)}</span>
            <span>{movement.accountName}</span>
            <MovementAmount cents={movement.amountCents} />
          </DataListRow>
        )}
        empty={
          isSearching ? (
            <EmptyState title="Nessun movimento con questo testo." />
          ) : account !== undefined ? (
            <EmptyState title="Nessun movimento su questo conto." />
          ) : (
            <EmptyState
              title="Nessun movimento."
              description="Importa un estratto conto per cominciare."
            >
              <Button
                render={<Link href="/finance/import" />}
                nativeButton={false}
              >
                Importa
              </Button>
            </EmptyState>
          )
        }
      />

      {page.hasMore ? (
        <Button
          variant="outline"
          render={<Link href={`/finance/movements?${more.toString()}`} />}
          nativeButton={false}
          className="self-center"
        >
          Mostra altri
        </Button>
      ) : null}
    </ListBody>
  )
}
