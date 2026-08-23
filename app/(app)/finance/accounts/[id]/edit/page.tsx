import { notFound } from "next/navigation"

import { saveFinanceAccount } from "@/app/(app)/finance/accounts/actions"
import { AccountForm } from "@/components/finance/account-form"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { requireSession } from "@/lib/auth"
import { getAccount } from "@/lib/services/finance/accounts"

export const metadata = { title: "Modifica conto" }

// Back into the field as the form expects it: an Italian comma, no thousands
// separator, which is exactly what SignedEuroCentsSchema accepts.
function balanceField(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}

export default async function EditFinanceAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await requireSession()
  const account = await getAccount(userId, id)

  // Not found and not "not yours": telling somebody a row exists is already
  // telling them something.
  if (account === null) notFound()

  return (
    <DetailBody>
      <PageHeader
        title={account.name}
        back={{ href: "/finance/accounts", label: "Conti" }}
        subtitle="Modifica il conto"
      />
      <AccountForm
        action={saveFinanceAccount}
        values={{
          id: account.id,
          name: account.name,
          provider: account.provider,
          openingBalance: balanceField(account.openingBalanceCents),
          openingBalanceAt: account.openingBalanceAt
            .toISOString()
            .slice(0, 10),
          shared: account.shared,
        }}
      />
    </DetailBody>
  )
}
