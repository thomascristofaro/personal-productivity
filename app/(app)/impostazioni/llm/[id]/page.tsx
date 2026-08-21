import Link from "next/link"
import { notFound } from "next/navigation"

import { saveFunction } from "@/app/(app)/impostazioni/llm/[id]/actions"
import { FunctionForm } from "@/components/llm/function-form"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { requireOwner } from "@/lib/auth/owner"
import { env } from "@/lib/env"
import { getFunction } from "@/lib/services/llm-registry"
import { decodeSegment } from "@/lib/route-params"

// The contract the service parses the answer against. Shown, never edited: a
// prompt edit must not be able to break what the code expects back — design
// document 2026-08-21 section 7.1.
const OUTPUT_SHAPE = `{
  slots: [
    { day: 0–6, meal: "LUNCH" | "DINNER", candidate: 1–N | null },
    … quattordici slot
  ]
}`

export default async function LlmFunctionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireOwner()

  const { id: raw } = await params
  const id = decodeSegment(raw)

  // A segment that will not decode names nothing, which is a 404 and not an
  // error to report.
  if (id === null) notFound()

  const fn = await getFunction(id)
  if (fn === null) notFound()

  return (
    <DetailBody>
      <PageHeader title={fn.name} subtitle={fn.description}>
        <Button
          variant="outline"
          render={<Link href={`/impostazioni/llm/${id}/esecuzioni`} />}
          nativeButton={false}
        >
          Esecuzioni
        </Button>
      </PageHeader>

      <FunctionForm
        id={id}
        action={saveFunction}
        models={env.GEMINI_MODELS}
        initial={{
          prompt: fn.prompt,
          model: fn.model,
          temperature: fn.temperature,
          maxTokens: fn.maxTokens,
          reasoning: fn.reasoning,
        }}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Forma della risposta</h2>
        <p className="text-xs text-muted-foreground">
          Non modificabile: è il contratto che il codice usa per leggere la
          risposta del modello.
        </p>
        <pre
          className="overflow-x-auto rounded-md bg-muted p-3 text-xs"
          translate="no"
        >
          {OUTPUT_SHAPE}
        </pre>
      </section>
    </DetailBody>
  )
}
