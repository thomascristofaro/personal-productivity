// A fact: what it is on the left, what it says on the right. A detail screen is
// mostly a stack of these, and before this each screen spelled it out again.
//
// A string label rather than a node: a fact whose name needs markup is not a
// fact, it is a section, and DetailSection is that.
export function DataRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm break-words">{children}</span>
    </div>
  )
}
