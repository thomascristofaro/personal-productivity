import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { requireOwner } from "@/lib/auth/owner"
import { listFunctions } from "@/lib/services/llm-registry"

export const metadata = { title: "Funzioni LLM" }

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
        announcement={`${functions.length} funzioni.`}
        empty={
          <EmptyState
            title="Nessuna funzione"
            description="Esegui il seed per creare la generazione del menù."
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
