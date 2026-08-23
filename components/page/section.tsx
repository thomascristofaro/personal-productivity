import { cn } from "@/lib/utils"

// The heading a section carries, in one place. `ListSection` is this plus the
// `<ul>`; a detail screen wants the same heading over rows or over a form, and
// before this it got it by copying the class list.
export function DetailSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    // gap-1, which is what ListSection had before the split. Changing it here
    // would move every list in the app to make room for a new caller.
    <section className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
