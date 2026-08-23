import Link from "next/link"

import { MessagePage } from "@/components/page/message-page"
import { Button } from "@/components/ui/button"

// Also the answer when the movement exists on an account this person cannot
// see. Distinguishing the two would confirm that the row is there, which is
// already saying something.
export default function NotFound() {
  return (
    <MessagePage title="Questo movimento non esiste.">
      <Button
        variant="outline"
        render={<Link href="/finance/movements" />}
        nativeButton={false}
      >
        Torna ai movimenti
      </Button>
    </MessagePage>
  )
}
