// There is deliberately no `variant` or `isSearching` prop. "Nothing exists
// yet" and "the filter matched nothing" are different copy and different
// actions, so they are two call sites, not one component with a boolean.
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description === undefined ? null : (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  )
}
