import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 pt-6">
      <span className="sr-only">Caricamento del ricettario…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
