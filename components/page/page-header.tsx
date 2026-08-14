import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export function PageHeader({
  title,
  back,
  children,
}: {
  title: string
  // One object rather than two optional props, so the href and its label
  // cannot drift apart: a back link naming the wrong destination is worse
  // than an unlabelled one.
  back?: { href: string; label: string }
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-2">
      {back === undefined ? null : (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold break-words">{title}</h1>
        {children === undefined ? null : (
          <div className="flex shrink-0 gap-2">{children}</div>
        )}
      </div>
    </header>
  )
}
