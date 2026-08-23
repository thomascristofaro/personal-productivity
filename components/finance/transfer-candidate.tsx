import { confirmPair } from "@/app/(app)/finance/transfers/actions"
import { MovementAmount } from "@/components/finance/movement-amount"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Declared here rather than imported from lib/services/finance/transfers: this
// file is client-reachable, and the layering rule holds for a type import too.
// The service's CandidateLeg is structurally this, and a mismatch is a type
// error at the call site — which is where it should be.
type CandidateLeg = {
  id: string
  date: Date
  amountCents: number
  description: string
  accountName: string
}

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
})

function Leg({ leg }: { leg: CandidateLeg }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm break-words">{leg.description}</span>
        <span className="text-xs text-muted-foreground">
          {leg.accountName} — {day.format(leg.date)}
        </span>
      </div>
      <MovementAmount cents={leg.amountCents} className="shrink-0 text-sm" />
    </div>
  )
}

export function TransferCandidateCard({
  outgoing,
  incoming,
}: {
  outgoing: CandidateLeg
  incoming: CandidateLeg
}) {
  return (
    <Card className="gap-3 p-4">
      <Leg leg={outgoing} />
      <Leg leg={incoming} />

      <form
        action={confirmPair.bind(null, outgoing.id, incoming.id)}
        className="self-start"
      >
        <Button type="submit" variant="outline" size="sm">
          Conferma
        </Button>
      </form>
    </Card>
  )
}
