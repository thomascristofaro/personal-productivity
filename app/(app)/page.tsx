import { redirect } from "next/navigation"

import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { MODULES, soleModule } from "@/lib/modules"

export const metadata = { title: "Home" }

export default function HomePage() {
  const modules = MODULES

  // One module is not a choice. Offering it as one would make everyone tap
  // through an extra screen to reach the only place they can go.
  const only = soleModule(modules)
  if (only !== null) redirect(only.href)

  return (
    <ListBody>
      <PageHeader title="Cosa apriamo?" />

      {/* The same row as every list in the app, rather than a card this screen
          owns: the fork is a list of two things you can open. */}
      <CardList>
        {modules.map((entry) => (
          <DataListRow key={entry.id} href={entry.href} title={entry.label}>
            {entry.description}
          </DataListRow>
        ))}
      </CardList>
    </ListBody>
  )
}
