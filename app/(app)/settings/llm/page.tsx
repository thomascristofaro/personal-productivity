import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { requireOwner } from "@/lib/auth/owner"
import { countLabel } from "@/lib/count-label"
import { listFunctions } from "@/lib/services/llm-registry"

export const metadata = { title: "Funzioni LLM" }

const FOUND = {
  none: "Nessuna funzione.",
  one: "funzione assistita",
  many: "funzioni assistite",
}

export default async function LlmFunctionsPage() {
  await requireOwner()

  const functions = await listFunctions()

  return (
    <ListBody>
      <PageHeader
        title="Funzioni LLM"
        subtitle="Prompt e modello di ogni funzione assistita"
      />

      <DataList
        items={functions}
        announcement={countLabel(functions.length, FOUND)}
        empty={
          <EmptyState
            title="Nessuna funzione"
            description="Nessuna funzione assistita è dichiarata nel codice."
          />
        }
        renderItem={(item) => (
          <DataListRow
            key={item.id}
            href={`/settings/llm/${item.id}`}
            title={item.name}
          >
            <span>{item.description}</span>
            <span translate="no">{item.model}</span>
          </DataListRow>
        )}
      />
    </ListBody>
  )
}
