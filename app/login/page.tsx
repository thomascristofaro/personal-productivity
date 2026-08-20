import { redirect } from "next/navigation"

import { GoogleSignIn } from "@/components/auth/google-sign-in"
import { getVerifiedSession } from "@/lib/auth"
import { safeNext } from "@/lib/safe-next"

export const metadata = { title: "Accedi" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ negato?: string; next?: string }>
}) {
  // Verified, not getSession(): in development the fallback would send every
  // visit straight back to the app, and signing in locally would be impossible.
  if ((await getVerifiedSession()) !== null) redirect("/menu")

  const { negato, next } = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-balance">Menù e spesa</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          L’accesso è riservato a due account.
        </p>
      </div>

      {negato === undefined ? null : (
        <p role="alert" className="text-sm text-pretty text-destructive">
          Questo account Google non è abilitato.
        </p>
      )}

      <GoogleSignIn callbackURL={safeNext(next)} />
    </main>
  )
}
