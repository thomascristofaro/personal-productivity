import Link from "next/link"
import { notFound } from "next/navigation"

import {
  addItem,
  complete,
  regenerate,
  removeItem,
  toggle,
} from "@/app/(app)/spesa/[weekStart]/actions"
import { EmptyState } from "@/components/page/empty-state"
import { PageHeader } from "@/components/page/page-header"
import { AddItemDrawer } from "@/components/shopping/add-item-drawer"
import { CompletePurchaseBar } from "@/components/shopping/complete-purchase-bar"
import { ShoppingList } from "@/components/shopping/shopping-list"
import { Button } from "@/components/ui/button"
import { AISLE_ORDER } from "@/lib/aisles"
import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { listCatalogOptions } from "@/lib/services/catalog"
import { getShoppingList } from "@/lib/services/shopping-lists"
import { groupByAisle, mergeLines } from "@/lib/services/shopping-view"
import { dateForDay, dayLabels } from "@/lib/week"

export const metadata = { title: "Spesa" }

const iso = (date: Date) => date.toISOString().slice(0, 10)

const rangeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

export default async function ShoppingWeekPage({
  params,
}: {
  params: Promise<{ weekStart: string }>
}) {
  const { weekStart: raw } = await params
  const parsed = WeekStartSchema.safeParse(raw)

  // A week that is not a Monday, or not a date at all, is not a week that
  // exists — not an error to report.
  if (!parsed.success) notFound()

  const weekStart = parsed.data
  const [list, catalog] = await Promise.all([
    getShoppingList(weekStart),
    listCatalogOptions(),
  ])

  // Over the stored rows and not the merged lines: what moves into the history
  // is rows, and a part-ticked line contributes only its ticked half.
  const checkedCount = (list?.items ?? []).filter((item) => item.checked).length
  const week = iso(weekStart)
  const range = `${rangeFormat.format(weekStart)} – ${rangeFormat.format(
    dateForDay(weekStart, DAYS_IN_WEEK - 1)
  )}`

  // pb-24 unconditionally: the completion bar is fixed over the foot of the
  // page, and an empty strip nobody scrolls to is cheaper than a conditional
  // that has to know whether the bar is showing.
  return (
    <main className="flex flex-col gap-4 pt-6 pb-24">
      <PageHeader title="Spesa" back={{ href: `/menu/${week}`, label: "Menù" }}>
        {/* Shown even on a week with no list: the history crosses the weeks, so
            it is never irrelevant. "Rigenera" is, and is not. */}
        <Button
          variant="outline"
          render={<Link href="/spesa/storico" />}
          nativeButton={false}
        >
          Storico
        </Button>
        {list === null ? null : (
          <form action={regenerate}>
            <input type="hidden" name="weekStart" value={week} />
            <Button type="submit" variant="outline">
              Rigenera
            </Button>
          </form>
        )}
      </PageHeader>

      <p className="text-sm text-muted-foreground">{range}</p>

      {list === null ? (
        <EmptyState
          title="Nessuna lista per questa settimana."
          description="Si costruisce dal menù: le ricette che hai messo negli slot diventano righe, raggruppate per reparto."
        >
          <form action={regenerate}>
            <input type="hidden" name="weekStart" value={week} />
            <Button type="submit">Genera la lista</Button>
          </form>
        </EmptyState>
      ) : (
        <>
          {list.stale ? (
            <p
              role="status"
              className="rounded-md border border-input bg-muted px-3 py-2 text-sm"
            >
              Il menù è cambiato dopo questa lista. Rigenerala per allinearla —
              le spunte e le righe aggiunte a mano restano.
            </p>
          ) : null}

          {list.items.length === 0 ? (
            <EmptyState
              title="La lista è vuota."
              description="Il menù di questa settimana non ha ricette con ingredienti."
            >
              <Button
                variant="outline"
                render={<Link href={`/menu/${week}`} />}
                nativeButton={false}
              >
                Vai al menù
              </Button>
            </EmptyState>
          ) : (
            <ShoppingList
              groups={groupByAisle(mergeLines(list.items))}
              dayLabels={dayLabels(weekStart)}
              weekStart={week}
              toggleAction={toggle}
              removeAction={removeItem}
            />
          )}

          <AddItemDrawer
            weekStart={week}
            catalog={catalog}
            aisles={AISLE_ORDER}
            action={addItem}
            aboveBar={checkedCount > 0}
          />

          <CompletePurchaseBar
            weekStart={week}
            checkedCount={checkedCount}
            action={complete}
          />
        </>
      )}
    </main>
  )
}
