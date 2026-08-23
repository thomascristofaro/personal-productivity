import Link from "next/link"

import { Card } from "@/components/ui/card"

// The card and its padding are the same whether or not the row leads anywhere,
// so they are written once and only the wrapper changes.
const INNER = "flex min-h-14 flex-col justify-center gap-1 px-4 py-3"

export function DataListRow({
  href,
  title,
  children,
}: {
  // Absent on a row that is a reading rather than a way in — the import
  // history. An anchor with nowhere to go is a keyboard stop that does nothing.
  href?: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  const content = (
    <>
      <span className="font-medium break-words">{title}</span>
      {children === undefined ? null : (
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {children}
        </span>
      )}
    </>
  )

  return (
    <li>
      <Card className="p-0">
        {href === undefined ? (
          <div className={INNER}>{content}</div>
        ) : (
          <Link href={href} className={INNER}>
            {content}
          </Link>
        )}
      </Card>
    </li>
  )
}
