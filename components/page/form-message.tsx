export function FormMessage({ children }: { children: string | null }) {
  if (children === null) return null

  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}
