"use client"

import { useState, useTransition } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type Props = {
  weekStart: string
  action: (weekStart: string) => Promise<{ error: string } | void>
}

export function GenerateButton({ weekStart, action }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await action(weekStart)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <Button type="button" disabled={pending} onClick={generate}>
        Genera il menù
      </Button>

      {/* One dialog, two states. On success neither is true and it closes by
          itself, because the action has already revalidated the grid. */}
      <AlertDialog
        open={pending || error !== null}
        onOpenChange={(open) => {
          // Dismissal is refused while the call is in flight: closing it would
          // leave the grid about to change under whoever dismissed it.
          if (!open && !pending) setError(null)
        }}
      >
        {/* Keyed on the state: without a remount the dialog is already open
            when waiting turns into failure, and a screen reader announces
            nothing — the one transition that most needs announcing. */}
        <AlertDialogContent key={pending ? "pending" : "error"}>
          {pending ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Sto preparando il menù…</AlertDialogTitle>
              <AlertDialogDescription>
                Sto scegliendo i piatti della settimana. Ci vuole qualche
                secondo.
              </AlertDialogDescription>
            </AlertDialogHeader>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Non ce l’ho fatta</AlertDialogTitle>
                <AlertDialogDescription>{error}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setError(null)}>
                  Chiudi
                </AlertDialogCancel>
                <AlertDialogAction onClick={generate}>
                  Riprova
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
