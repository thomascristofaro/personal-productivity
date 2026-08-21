"use client"

import { useState } from "react"

import { authClient } from "@/components/auth/client"
import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"

export function GoogleSignIn({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)

          const { error } = await authClient.signIn.social({
            provider: "google",
            // Where the session gate wanted to send us, already checked by
            // `safeNext` — a shared recipe survives an expired session.
            callbackURL,
            // Where a refused account lands. Sign-up is disabled, so an address
            // that is not seeded gets here — without this it would meet a raw
            // error page instead of being told, in Italian, what happened.
            errorCallbackURL: "/login?denied=1",
          })

          // On success the browser has already left for Google, so arriving
          // here at all means the redirect never started.
          if (error !== undefined && error !== null) {
            setFailed(true)
            setPending(false)
          }
        }}
      >
        {pending ? "Apro Google…" : "Accedi con Google"}
      </Button>

      {/* No FormState here — this is a client call, not a server action — but
          the message a failed one shows is the same message, so it is the same
          component rather than a sixth hand-written role="alert". */}
      <FormMessage>
        {failed
          ? "Non è stato possibile aprire l’accesso Google. Riprova."
          : null}
      </FormMessage>
    </div>
  )
}
