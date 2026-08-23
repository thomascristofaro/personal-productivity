import { confirmAllSettled } from "@/app/(app)/finance/transfers/actions"
import { TransferCandidateCard } from "@/components/finance/transfer-candidate"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { listTransferCandidates } from "@/lib/services/finance/transfers"

export const metadata = { title: "Trasferimenti" }

export default async function TransfersPage() {
  const { userId } = await requireSession()
  const candidates = await listTransferCandidates(userId)

  const settled = candidates.filter((pair) => !pair.contested)
  const contested = candidates.filter((pair) => pair.contested)

  return (
    <ListBody>
      <PageHeader
        title="Trasferimenti da confermare"
        back={{ href: "/finance", label: "Finanza" }}
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="Nessun trasferimento da confermare."
          description="Quando due conti si scambiano la stessa cifra a pochi giorni di distanza, la coppia compare qui."
        />
      ) : (
        <>
          {/* The reason to be on this screen, and the truth of section 8.2 of
              the design document. */}
          <p className="text-sm text-muted-foreground">
            Finché non li confermi, questi movimenti contano come entrate e come
            uscite.
          </p>

          {settled.length === 0 ? null : (
            <DetailSection title="Coppie chiare" className="gap-3">
              {settled.length > 1 ? (
                <form action={confirmAllSettled} className="self-start">
                  <Button type="submit" className="self-start">
                    Conferma tutte
                  </Button>
                </form>
              ) : null}

              <div className="flex flex-col gap-3">
                {settled.map((pair) => (
                  <TransferCandidateCard
                    key={`${pair.outgoing.id}-${pair.incoming.id}`}
                    outgoing={pair.outgoing}
                    incoming={pair.incoming}
                  />
                ))}
              </div>
            </DetailSection>
          )}

          {contested.length === 0 ? null : (
            <DetailSection title="Da scegliere" className="gap-3">
              <p className="text-sm text-muted-foreground">
                Questi movimenti hanno più di un possibile gemello. Scegline
                uno: nessuno viene confermato in blocco.
              </p>

              <div className="flex flex-col gap-3">
                {contested.map((pair) => (
                  <TransferCandidateCard
                    key={`${pair.outgoing.id}-${pair.incoming.id}`}
                    outgoing={pair.outgoing}
                    incoming={pair.incoming}
                  />
                ))}
              </div>
            </DetailSection>
          )}
        </>
      )}
    </ListBody>
  )
}
