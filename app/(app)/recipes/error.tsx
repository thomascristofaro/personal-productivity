"use client"

import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-col items-center gap-4 pt-24 text-center">
      <p role="alert" className="text-sm">
        Qualcosa è andato storto. Controlla la connessione e riprova.
      </p>
      <Button variant="outline" onClick={reset}>
        Riprova
      </Button>
    </main>
  )
}
