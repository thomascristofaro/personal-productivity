import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  generateWeek,
  saveSlot,
} from "@/app/(app)/menu/[weekStart]/actions"
import { GenerateButton } from "@/components/menu/generate-button"
import { WeekGrid } from "@/components/menu/week-grid"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { getMenuWeek } from "@/lib/services/menus"
import { listRecipes } from "@/lib/services/recipes"
import { dateForDay, dayIndexFor, weekStartFor } from "@/lib/week"

export const metadata = { title: "Menù" }

const iso = (date: Date) => date.toISOString().slice(0, 10)

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "numeric",
})

const rangeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "long",
})

export default async function MenuWeekPage({
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
  const [slots, recipes] = await Promise.all([
    getMenuWeek(weekStart),
    listRecipes(),
  ])

  const dayLabels = Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    dayFormat.format(dateForDay(weekStart, day))
  )

  // Generating writes into the slots, so it is offered only where there is
  // nothing to overwrite — design document 2026-08-21 section 8.
  const isEmptyWeek = slots.every(
    (slot) => slot.recipeId === null && slot.freeText === null
  )

  const isCurrentWeek = iso(weekStartFor(new Date())) === iso(weekStart)
  const todayIndex = isCurrentWeek ? dayIndexFor(new Date()) : -1

  const previous = iso(dateForDay(weekStart, -DAYS_IN_WEEK))
  const next = iso(dateForDay(weekStart, DAYS_IN_WEEK))
  const range = `${rangeFormat.format(weekStart)} – ${rangeFormat.format(
    dateForDay(weekStart, DAYS_IN_WEEK - 1)
  )}`

  return (
    <ListBody>
      <PageHeader title="Menù" subtitle={range}>
        {isEmptyWeek && (
          <GenerateButton weekStart={iso(weekStart)} action={generateWeek} />
        )}
        <Button
          variant="outline"
          render={<Link href={`/spesa/${iso(weekStart)}`} />}
          nativeButton={false}
        >
          Spesa
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settimana precedente"
          render={<Link href={`/menu/${previous}`} />}
          nativeButton={false}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settimana successiva"
          render={<Link href={`/menu/${next}`} />}
          nativeButton={false}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </PageHeader>

      <WeekGrid
        weekStart={iso(weekStart)}
        slots={slots}
        dayLabels={dayLabels}
        todayIndex={todayIndex}
        recipes={recipes.map(({ id, title }) => ({ id, title }))}
        saveAction={saveSlot}
      />
    </ListBody>
  )
}
