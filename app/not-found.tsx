import Link from "next/link"

import { MessagePage } from "@/components/page/message-page"
import { Button } from "@/components/ui/button"

// A URL that matches no route at all never reaches the app segment, so it never
// reaches that segment's not-found either. This one has no shell around it —
// there is no telling which module the user was aiming for — and unlike the
// others it does answer a real 404.
export default function NotFound() {
  return (
    <MessagePage title="Questa pagina non esiste." className="px-6">
      <Button
        variant="outline"
        render={<Link href="/menu" />}
        nativeButton={false}
      >
        Torna al menù
      </Button>
    </MessagePage>
  )
}
