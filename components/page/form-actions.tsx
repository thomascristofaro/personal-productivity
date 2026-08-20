import Link from "next/link"

import { Button } from "@/components/ui/button"

export function FormActions({
  cancelHref,
  isPending,
  submitLabel = "Salva",
  pendingLabel = "Salvo…",
}: {
  // Absent when there is nowhere to go back to, and then there is no Annulla:
  // a link that cancels to the page you are already on says nothing.
  cancelHref?: string
  isPending: boolean
  submitLabel?: string
  pendingLabel?: string
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
      {cancelHref === undefined ? null : (
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
      )}
    </div>
  )
}
