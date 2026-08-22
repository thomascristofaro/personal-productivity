import Link from "next/link"
import { notFound } from "next/navigation"

import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { requireOwner } from "@/lib/auth/owner"
import { APP_TIMEZONE } from "@/lib/config"
import { decodeSegment } from "@/lib/route-params"
import { getExecution } from "@/lib/services/llm-registry"

export const metadata = { title: "Esecuzione" }

const stampFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: APP_TIMEZONE,
  dateStyle: "full",
  timeStyle: "medium",
})

const numberFormat = new Intl.NumberFormat("it-IT")

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </section>
  )
}

export default async function ExecutionPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>
}) {
  await requireOwner()

  const { id: rawId, runId: rawRunId } = await params
  const id = decodeSegment(rawId)
  const runId = decodeSegment(rawRunId)

  if (id === null || runId === null) notFound()

  const run = await getExecution(id, runId)
  if (run === null) notFound()

  return (
    <DetailBody>
      <PageHeader
        title="Esecuzione"
        subtitle={stampFormat.format(run.createdAt)}
      >
        <Button
          variant="outline"
          render={<Link href={`/settings/llm/${id}/runs`} />}
          nativeButton={false}
        >
          Torna alle esecuzioni
        </Button>
      </PageHeader>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Modello</dt>
          <dd translate="no">{run.model}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Token</dt>
          <dd className="tabular-nums">
            {numberFormat.format(run.inputTokens ?? 0)} in ·{" "}
            {numberFormat.format(run.outputTokens ?? 0)} out
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Durata</dt>
          <dd className="tabular-nums">
            {numberFormat.format(run.durationMs)} ms
          </dd>
        </div>
      </dl>

      {run.error !== null && <Block title="Errore">{run.error}</Block>}

      {/* Selectable and never truncated: this is what makes the history a
          version history — going back to a prompt is copying it from here. */}
      <Block title="Prompt usato">{run.prompt}</Block>

      {run.output !== null && <Block title="Risposta">{run.output}</Block>}
    </DetailBody>
  )
}
