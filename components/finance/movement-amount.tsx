import { formatEuro } from "@/lib/money"
import { cn } from "@/lib/utils"

export function MovementAmount({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        // Colour is the second signal, never the only one: the minus sign
        // formatEuro renders is the first, and it survives a monochrome screen
        // and every kind of colour blindness.
        cents < 0 ? "text-foreground" : "text-emerald-700 dark:text-emerald-400",
        className
      )}
    >
      {formatEuro(cents)}
    </span>
  )
}
