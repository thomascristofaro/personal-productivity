import { cn } from "@/lib/utils"

// One message, two meanings. Before this it had one: every `state.message` was
// painted in the error colour and announced with `role="alert"`, so an action
// returning `success("Impostazioni salvate.")` told the user in red that
// something had gone wrong. /settings/llm did exactly that, and shipped.
export function FormMessage({
  children,
  ok = false,
}: {
  children: string | null
  // Defaults to a refusal: a caller that has not thought about it is almost
  // always reporting one, and getting this wrong in that direction only makes
  // a real error louder.
  ok?: boolean
}) {
  if (children === null) return null

  return (
    <p
      // `alert` interrupts a screen reader mid-sentence; `status` waits for a
      // pause. A confirmation has not earned an interruption.
      role={ok ? "status" : "alert"}
      className={cn(
        "text-sm",
        ok ? "text-muted-foreground" : "text-destructive"
      )}
    >
      {children}
    </p>
  )
}
