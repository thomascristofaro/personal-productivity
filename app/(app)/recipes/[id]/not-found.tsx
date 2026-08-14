import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="text-sm">Questa ricetta non esiste più.</p>
      <Button
        variant="outline"
        render={<Link href="/recipes" />}
        nativeButton={false}
      >
        Torna al ricettario
      </Button>
    </main>
  )
}
