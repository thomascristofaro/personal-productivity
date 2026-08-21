import Link from "next/link"

import { MessagePage } from "@/components/page/message-page"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <MessagePage title="Questa esecuzione non esiste più.">
      <Button
        variant="outline"
        render={<Link href="/settings/llm" />}
        nativeButton={false}
      >
        Torna alle funzioni
      </Button>
    </MessagePage>
  )
}
