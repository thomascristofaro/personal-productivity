"use client"

import { useState } from "react"

import { authClient } from "@/components/auth/client"
import { Button } from "@/components/ui/button"

export function GoogleSignIn() {
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
            callbackURL: "/menu",
            // Where a refused account lands. Sign-up is disabled, so an address
            // that is not seeded gets here — without this it would meet a raw
            // error page instead of being told, in Italian, what happened.
            errorCallbackURL: "/login?negato=1",
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

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Non è stato possibile aprire l’accesso Google. Riprova.
        </p>
      ) : null}
    </div>
  )
}
