import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export function PageHeader({
  title,
  back,
  subtitle,
  children,
}: {
  title: string
  // One object rather than two optional props, so the href and its label
  // cannot drift apart: a back link naming the wrong destination is worse
  // than an unlabelled one.
  back?: { href: string; label: string }
  // The muted line under the title — a date range, a total, a row of badges.
  // A ReactNode because one of the four holds badges, and a prop rather than a
  // `<p>` at the call site because four pages were each deciding its size and
  // one of them had drifted to a smaller one that nobody chose.
  subtitle?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-2">
      {back === undefined ? null : (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold text-pretty break-words">
          {title}
        </h1>
        {children === undefined ? null : (
          <div className="flex shrink-0 gap-2">{children}</div>
        )}
      </div>
      {subtitle === undefined ? null : (
        // Flex-wrap for the badge case; a plain sentence is one child and does
        // not notice.
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
    </header>
  )
}
