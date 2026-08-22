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
  // How many slots already hold something. Zero means generating overwrites
  // nothing and can go straight ahead.
  filledSlots: number
  action: (
    weekStart: string,
    overwrite?: boolean
  ) => Promise<{ error: string } | void>
}

type Stage = "idle" | "confirming" | "error"

// What the dialog is showing. "idle" is not one of these: the dialog is closed
// then, and while it animates out it must keep showing whatever it showed last.
type View = "pending" | "confirming" | "error"

export function GenerateButton({ weekStart, filledSlots, action }: Props) {
  const [pending, startTransition] = useTransition()
  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState<string | null>(null)

  function run(overwrite: boolean) {
    setStage("idle")
    setError(null)
    startTransition(async () => {
      try {
        const result = await action(weekStart, overwrite)
        if (result?.error) {
          setError(result.error)
          setStage("error")
        }
      } catch {
        // Without this the transition rejects, nothing is shown, and the
        // waiting dialog simply vanishes — the one outcome this screen exists
        // to prevent.
        setError("Qualcosa è andato storto. Riprova.")
        setStage("error")
      }
    })
  }

  function start() {
    if (filledSlots > 0) {
      setStage("confirming")
      return
    }
    run(false)
  }

  const open = pending || stage !== "idle"

  // The view lags the state by design. Deriving it from `stage` directly meant
  // that dismissing the confirmation switched the content to the error branch
  // while the dialog was still animating out — and because the content is
  // keyed, Base UI saw a remount rather than a close and left the error panel
  // on screen, with an empty description. Cancelling looked like a failure.
  const [view, setView] = useState<View>("confirming")
  const current: View | "idle" = pending ? "pending" : stage
  if (current !== "idle" && current !== view) setView(current)

  return (
    <>
      <Button
        variant="outline"
        type="button"
        disabled={pending}
        onClick={start}
      >
        Genera il menù
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Dismissal is refused while the call is in flight: closing it would
          // leave the grid about to change under whoever dismissed it.
          if (!next && !pending) {
            setStage("idle")
            setError(null)
          }
        }}
      >
        {/* Keyed on the view: without a remount the dialog is already open
            when one state turns into another, and a screen reader announces
            nothing — the transitions that most need announcing. */}
        <AlertDialogContent key={view}>
          {view === "pending" ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Sto preparando il menù…</AlertDialogTitle>
              <AlertDialogDescription>
                Sto scegliendo i piatti della settimana. Ci vuole qualche
                secondo.
              </AlertDialogDescription>
            </AlertDialogHeader>
          ) : view === "confirming" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Sovrascrivo la settimana?</AlertDialogTitle>
                <AlertDialogDescription>
                  {filledSlots === 1
                    ? "C’è già un pasto in questa settimana e verrà sostituito."
                    : `Ci sono già ${filledSlots} pasti in questa settimana e verranno sostituiti.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStage("idle")}>
                  Annulla
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => run(true)}>
                  Genera lo stesso
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Non ce l’ho fatta</AlertDialogTitle>
                <AlertDialogDescription>{error}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStage("idle")}>
                  Chiudi
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => run(filledSlots > 0)}>
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
