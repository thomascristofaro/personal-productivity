"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/components/auth/client"
import { Button } from "@/components/ui/button"

export function SignOut() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <Button
      variant="ghost"
      className="-ml-3 justify-start"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signOut()
        // refresh() as well as push(): without it the server components of the
        // page just left stay in the router cache, and Back shows the app again.
        router.push("/login")
        router.refresh()
      }}
    >
      <LogOut aria-hidden="true" />
      <span>{pending ? "Esco…" : "Esci"}</span>
    </Button>
  )
}
