import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { DataRow } from "@/components/page/data-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { countLabel } from "@/lib/count-label"
import { addMonths, monthFromKey, monthKeyOf, monthStartFor } from "@/lib/month"
import { formatEuro } from "@/lib/money"
import { firstOf } from "@/lib/search-params"
import { listAccounts } from "@/lib/services/finance/accounts"
import { countUncategorised } from "@/lib/services/finance/apply-rules"
import { monthSummary } from "@/lib/services/finance/month-summary"
import { UNCATEGORISED_FILTER } from "@/lib/services/finance/movements"
import { countTransferCandidates } from "@/lib/services/finance/transfers"

export const metadata = { title: "Finanza" }

const WAYS_IN = [
  { href: "/finance/movements", label: "Movimenti" },
  { href: "/finance/import", label: "Importa" },
  { href: "/finance/accounts", label: "Conti" },
  { href: "/finance/rules", label: "Regole" },
] as const

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
})

const monthName = new Intl.DateTimeFormat("it-IT", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
})

const TO_SORT = {
  none: "",
  one: "movimento da categorizzare",
  many: "movimenti da categorizzare",
}

const TO_CONFIRM = {
  none: "",
  one: "trasferimento da confermare",
  many: "trasferimenti da confermare",
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const { month: rawMonth } = await searchParams
  const asked = firstOf(rawMonth)

  const thisMonth = monthStartFor(new Date())
  // An unreadable month is not an error worth a screen: it is a hand-typed
  // address, and the current month is what somebody arriving wants anyway.
  const monthStart = (asked === undefined ? null : monthFromKey(asked)) ?? thisMonth

  const { userId } = await requireSession()
  const [accounts, summary, toSort, toConfirm] = await Promise.all([
    listAccounts(userId),
    monthSummary(userId, monthStart),
    countUncategorised(userId),
    countTransferCandidates(userId),
  ])

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

  const total = accounts.reduce((sum, account) => sum + account.balanceCents, 0)
  const difference = summary.incomeCents + summary.outgoingsCents
  const previous = monthKeyOf(addMonths(monthStart, -1))
  const next = monthKeyOf(addMonths(monthStart, 1))
  const isCurrentMonth = monthStart.getTime() === thisMonth.getTime()

  return (
    <ListBody>
      <PageHeader title="Finanza" />

      {toConfirm === 0 ? null : (
        <Alert>
          <AlertTitle>
            <Link href="/finance/transfers" className="underline underline-offset-3">
              {countLabel(toConfirm, TO_CONFIRM)}
            </Link>
          </AlertTitle>
          {/* Above the numbers and not beneath them: until a pair is confirmed
              it counts as both income and an outgoing, so what follows is not
              yet true. */}
          <AlertDescription>
            Finché non li confermi, i totali qui sotto non sono ancora veri.
          </AlertDescription>
        </Alert>
      )}

      {toSort === 0 ? null : (
        <Alert>
          <AlertTitle>
            <Link
              href={`/finance/movements?category=${UNCATEGORISED_FILTER}`}
              className="underline underline-offset-3"
            >
              {countLabel(toSort, TO_SORT)}
            </Link>
          </AlertTitle>
        </Alert>
      )}

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

      <DetailSection title={monthName.format(monthStart)} className="gap-2">
        <div className="flex items-center justify-between gap-2 pb-1">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/finance?month=${previous}`} />}
            nativeButton={false}
          >
            <ChevronLeft aria-hidden="true" />
            {monthName.format(addMonths(monthStart, -1))}
          </Button>

          {isCurrentMonth ? null : (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/finance?month=${next}`} />}
              nativeButton={false}
            >
              {monthName.format(addMonths(monthStart, 1))}
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>

        <DataRow label="Entrate">
          <span className="tabular-nums">
            {formatEuro(summary.incomeCents)}
          </span>
        </DataRow>
        <DataRow label="Uscite">
          <span className="tabular-nums">
            {formatEuro(summary.outgoingsCents)}
          </span>
        </DataRow>
        <DataRow label="Differenza">
          <span className="font-semibold tabular-nums">
            {formatEuro(difference)}
          </span>
        </DataRow>
      </DetailSection>

      {summary.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna uscita in questo mese.
        </p>
      ) : (
        <DetailSection title="Dove sono andati" className="gap-2">
          <CardList>
            {summary.categories.map((category) => (
              <DataListRow
                key={category.categoryId ?? "none"}
                href={`/finance/movements?category=${category.categoryId ?? UNCATEGORISED_FILTER}`}
                title={category.name}
              >
                <span className="font-medium text-foreground tabular-nums">
                  {formatEuro(category.cents)}
                </span>
                <span>
                  {category.meanCents === null
                    ? "primo mese"
                    : `di solito ${formatEuro(category.meanCents)}`}
                </span>
              </DataListRow>
            ))}
          </CardList>
        </DetailSection>
      )}

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
