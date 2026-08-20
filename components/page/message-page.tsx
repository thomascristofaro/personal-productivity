import { cn } from "@/lib/utils"

// Not EmptyState: that renders a <p>, which is right inside a page whose <h1>
// comes from PageHeader. These screens have no PageHeader, so folding them in
// would leave three pages with no heading at all.
export function MessagePage({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <main
      className={cn(
        "flex flex-col items-center gap-4 pt-24 text-center",
        className
      )}
    >
      <h1 className="text-sm">{title}</h1>
      {children}
    </main>
  )
}
