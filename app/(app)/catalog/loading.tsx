import { ListSkeleton } from "@/components/page/list-skeleton"

export default function Loading() {
  return <ListSkeleton label="Caricamento del catalogo…" rows={6} />
}
