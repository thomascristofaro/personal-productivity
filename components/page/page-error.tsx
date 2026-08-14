"use client"

import { Button } from "@/components/ui/button"

// The copy is generic on purpose. A per-module error message would be a
// per-module decision to make, forget, and get inconsistent.
export function PageError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <p role="alert" className="text-sm">
        Qualcosa è andato storto. Controlla la connessione e riprova.
      </p>
      <Button variant="outline" onClick={reset}>
        Riprova
      </Button>
    </div>
  )
}
