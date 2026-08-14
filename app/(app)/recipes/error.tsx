"use client"

import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="text-sm">
        Non riesco a caricare il ricettario. Controlla la connessione e riprova.
      </p>
      <Button variant="outline" onClick={reset}>
        Riprova
      </Button>
    </main>
  )
}
