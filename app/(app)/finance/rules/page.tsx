import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import Link from "next/link"

import {
  addRule,
  removeRule,
  reorderRule,
  runRulesOnPast,
} from "@/app/(app)/finance/rules/actions"
import { RuleForm } from "@/components/finance/rule-form"
import { RunRulesButton } from "@/components/finance/run-rules-button"
import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { DetailSection } from "@/components/page/section"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/auth"
import { RULE_KIND_LABELS } from "@/lib/schemas/finance"
import { listAccounts } from "@/lib/services/finance/accounts"
import { listCategories } from "@/lib/services/finance/categories"
import { listRules } from "@/lib/services/finance/rules"

export const metadata = { title: "Regole" }

export default async function RulesPage() {
  const { userId } = await requireSession()
  const [rules, categories, accounts] = await Promise.all([
    listRules(),
    listCategories(),
    listAccounts(userId),
  ])

  const options = Object.fromEntries(
    categories
      .filter((category) => !category.archived)
      .map((category) => [category.id, category.name])
  )

  const accountOptions = Object.fromEntries(
    accounts.map((account) => [account.id, account.name])
  )

  return (
    <ListBody>
      <PageHeader title="Regole" back={{ href: "/finance", label: "Finanza" }}>
        <Button
          variant="outline"
          render={<Link href="/finance/categories" />}
          nativeButton={false}
        >
          Categorie
        </Button>
      </PageHeader>

      {/* "First match wins" is invisible in a list and it is the whole
          behaviour. */}
      <p className="text-sm text-muted-foreground">
        Vince la prima regola che corrisponde. Quelle sulla descrizione vengono
        provate prima di quelle sulla categoria del servizio.
      </p>

      {rules.length === 0 ? (
        <EmptyState
          title="Nessuna regola."
          description="Le regole si scrivono più comodamente da un movimento: scegli la categoria e spunta «Ricorda questa scelta»."
        />
      ) : (
        <CardList>
          {rules.map((rule) => (
            <DataListRow
              key={rule.id}
              title={
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">
                    {RULE_KIND_LABELS[rule.kind]} «{rule.pattern}»
                  </span>
                  <span className="flex shrink-0 gap-0.5">
                    <form action={reorderRule.bind(null, rule.id, "up")}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Prova prima la regola ${rule.pattern}`}
                      >
                        <ChevronUp aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={reorderRule.bind(null, rule.id, "down")}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Prova dopo la regola ${rule.pattern}`}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={removeRule.bind(null, rule.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Elimina la regola ${rule.pattern}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </form>
                  </span>
                </span>
              }
            >
              <span>{rule.categoryName}</span>
              <span>{rule.accountName ?? "tutti i conti"}</span>
            </DataListRow>
          ))}
        </CardList>
      )}

      <DetailSection title="Nuova regola" className="gap-3">
        <RuleForm
          action={addRule}
          categories={options}
          accounts={accountOptions}
        />
      </DetailSection>

      <DetailSection title="Movimenti già importati" className="gap-3">
        <p className="text-sm text-muted-foreground">
          Le regole partono da sole solo sui movimenti nuovi. Qui le applichi a
          quelli già dentro: le categorie scelte a mano restano come sono.
        </p>
        <RunRulesButton action={runRulesOnPast} />
      </DetailSection>
    </ListBody>
  )
}
