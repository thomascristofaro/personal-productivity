"use client"

import { Button } from "@/components/ui/button"

// The copy is generic on purpose. A per-module error message would be a
// per-module decision to make, forget, and get inconsistent.
//
// `error` is accepted and ignored: Next hands it to every error boundary, and
// taking it here is what lets each route's error.tsx be a bare re-export.
export function PageError({ reset }: { error?: Error; reset: () => void }) {
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
