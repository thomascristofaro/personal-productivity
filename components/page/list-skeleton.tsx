import { Skeleton } from "@/components/ui/skeleton"

export function ListSkeleton({
  label,
  rows = 4,
}: {
  label: string
  rows?: number
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 pt-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
