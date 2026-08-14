import Link from "next/link"

import { Card } from "@/components/ui/card"

export function DataListRow({
  href,
  title,
  children,
}: {
  href: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <li>
      <Card className="p-0">
        <Link
          href={href}
          className="flex min-h-14 flex-col justify-center gap-1 px-4 py-3"
        >
          <span className="font-medium">{title}</span>
          {children === undefined ? null : (
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {children}
            </span>
          )}
        </Link>
      </Card>
    </li>
  )
}
