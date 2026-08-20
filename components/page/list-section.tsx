import { cn } from "@/lib/utils"

// The section, not a list of sections: two callers map over aisle groups and a
// third has a single section with a fixed title. A component taking the groups
// would force that third one to pass an array of one.
export function ListSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}
