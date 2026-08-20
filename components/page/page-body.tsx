import { cn } from "@/lib/utils"

// Two components rather than one with a `dense` prop: a list and a form are
// different screens, not one screen in two modes.
export function ListBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn("flex flex-col gap-4 pt-6", className)}>
      {children}
    </main>
  )
}

export function DetailBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn("flex flex-col gap-6 pt-6", className)}>
      {children}
    </main>
  )
}
