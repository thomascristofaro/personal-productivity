import Link from "next/link"

import { Button } from "@/components/ui/button"

// The catch-all for the whole app segment: without it Next serves its own 404,
// which is in English and outside the shell. `recipes/[id]` keeps its own,
// nearer, version because it can say which thing is missing.
//
// This ships with a 200 for the same reason that one does — the shell has
// already streamed by the time notFound() throws. Accepted: the app is private
// and nothing crawls it.
export default function NotFound() {
  return (
    <main className="flex flex-col items-center gap-4 pt-24 text-center">
      <h1 className="text-sm">Questa pagina non esiste.</h1>
      <Button
        variant="outline"
        render={<Link href="/menu" />}
        nativeButton={false}
      >
        Torna al menù
      </Button>
    </main>
  )
}
