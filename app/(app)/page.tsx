import Link from "next/link"
import { redirect } from "next/navigation"

import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { Card } from "@/components/ui/card"
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

      <ul className="flex flex-col gap-3">
        {modules.map((module) => (
          <li key={module.id}>
            <Card className="p-0">
              <Link
                href={module.href}
                className="flex min-h-24 flex-col justify-center gap-1 px-5 py-4"
              >
                <span className="text-xl font-semibold">{module.label}</span>
                <span className="text-sm text-muted-foreground">
                  {module.description}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </ListBody>
  )
}
