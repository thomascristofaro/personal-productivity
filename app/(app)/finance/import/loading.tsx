import { ListSkeleton } from "@/components/page/list-skeleton"

export default function Loading() {
  return <ListSkeleton label="Caricamento dell’import…" rows={3} />
}
