import Link from "next/link"

import { MessagePage } from "@/components/page/message-page"
import { Button } from "@/components/ui/button"

// This screen ships with a 200, not a 404: app/(app)/recipes/loading.tsx puts
// the whole segment behind a Suspense boundary, so Next streams that fallback
// with a 200 before this page's async work resolves and the status is fixed
// by the time notFound() runs. Accepted — the app is private and nothing
// crawls it.
export default function NotFound() {
  return (
    <MessagePage title="Questa ricetta non esiste più.">
      <Button
        variant="outline"
        render={<Link href="/recipes" />}
        nativeButton={false}
      >
        Torna al ricettario
      </Button>
    </MessagePage>
  )
}
