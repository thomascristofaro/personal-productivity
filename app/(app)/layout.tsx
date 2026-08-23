import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { Toaster } from "@/components/ui/sonner"
import { getSession } from "@/lib/auth"
import { isOwner } from "@/lib/auth/owner"
import { db } from "@/lib/db"
import { MODULES } from "@/lib/modules"

// This layout stays a server component: AppNav is a client component, but it
// sits beside `children` rather than around it, so the pages below keep
// rendering on the server.
//
// The redirect here is the server-side gate. The proxy only looks for a cookie
// and cannot authorise; this can, and does.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (session === null) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  })

  return (
    <>
      <AppNav
        userName={user?.name ?? ""}
        modules={MODULES}
        isOwner={user !== null && isOwner(user.email)}
      />
      <div className="mx-auto w-full max-w-2xl pr-[max(--spacing(4),env(safe-area-inset-right))] pb-[calc(--spacing(24)+env(safe-area-inset-bottom))] pl-[max(--spacing(4),env(safe-area-inset-left))]">
        {children}
      </div>
      <Toaster position="top-center" />
    </>
  )
}
