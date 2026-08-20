import Link from "next/link"

import { Button } from "@/components/ui/button"

export function FormActions({
  cancelHref,
  isPending,
  submitLabel = "Salva",
  pendingLabel = "Salvo…",
}: {
  cancelHref: string
  isPending: boolean
  submitLabel?: string
  pendingLabel?: string
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
      <Button
        variant="ghost"
        render={
          <Link
            href={cancelHref}
            // Discarding is the whole point of this link, so the unsaved
            // changes guard steps aside for it.
            data-discard=""
          />
        }
        nativeButton={false}
      >
        Annulla
      </Button>
    </div>
  )
}
