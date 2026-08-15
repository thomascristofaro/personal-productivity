import Link from "next/link"

import { Button } from "@/components/ui/button"

// A URL that matches no route at all never reaches the app segment, so it never
// reaches that segment's not-found either. This one has no shell around it —
// there is no telling which module the user was aiming for — and unlike the
// others it does answer a real 404.
export default function NotFound() {
  return (
    <main className="flex flex-col items-center gap-4 px-6 pt-24 text-center">
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
