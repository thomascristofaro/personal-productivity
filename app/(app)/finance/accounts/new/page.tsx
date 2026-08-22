import { saveFinanceAccount } from "@/app/(app)/finance/accounts/actions"
import { AccountForm } from "@/components/finance/account-form"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"

export const metadata = { title: "Nuovo conto" }

// Today, so the opening balance defaults to "quello che c'è adesso" — the
// answer somebody opening this screen already has in front of them.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewFinanceAccountPage() {
  return (
    <DetailBody>
      <PageHeader
        title="Nuovo conto"
        back={{ href: "/finance/accounts", label: "Conti" }}
      />
      <AccountForm
        action={saveFinanceAccount}
        values={{
          name: "",
          provider: "REVOLUT",
          openingBalance: "",
          openingBalanceAt: today(),
          shared: false,
        }}
      />
    </DetailBody>
  )
}
