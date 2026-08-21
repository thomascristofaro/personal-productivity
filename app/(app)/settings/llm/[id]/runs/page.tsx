import Link from "next/link"
import { notFound } from "next/navigation"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { requireOwner } from "@/lib/auth/owner"
import { APP_TIMEZONE } from "@/lib/config"
import { decodeSegment } from "@/lib/route-params"
import { listExecutions } from "@/lib/services/llm-registry"

export const metadata = { title: "Esecuzioni" }

const stampFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
})

const numberFormat = new Intl.NumberFormat("it-IT")

export default async function ExecutionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireOwner()

  const { id: raw } = await params
  const id = decodeSegment(raw)

  if (id === null) notFound()

  const executions = await listExecutions(id)

  return (
    <ListBody>
      <PageHeader title="Esecuzioni" subtitle="Le ultime venti chiamate">
        <Button
          variant="outline"
          render={<Link href={`/settings/llm/${id}`} />}
          nativeButton={false}
        >
          Torna alla funzione
        </Button>
      </PageHeader>

      <DataList
        items={executions}
        announcement={`${executions.length} esecuzioni.`}
        empty={
          <EmptyState
            title="Nessuna esecuzione"
            description="Genera un menù e la chiamata comparirà qui."
          />
        }
        renderItem={(run) => (
          <DataListRow
            key={run.id}
            href={`/settings/llm/${id}/runs/${run.id}`}
            title={stampFormat.format(run.createdAt)}
          >
            {run.error === null ? (
              <span className="tabular-nums">
                {numberFormat.format(run.inputTokens ?? 0)} in ·{" "}
                {numberFormat.format(run.outputTokens ?? 0)} out
              </span>
            ) : (
              <span className="text-destructive">Fallita</span>
            )}
            <span className="tabular-nums">
              {numberFormat.format(run.durationMs)} ms
            </span>
            <span translate="no">{run.model}</span>
          </DataListRow>
        )}
      />
    </ListBody>
  )
}
