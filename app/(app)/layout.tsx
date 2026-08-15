import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

// This layout stays a server component: SidebarProvider is a client component,
// but `children` is passed to it as a slot, so the pages below keep rendering
// on the server.
//
// The redirect here is the server-side gate. The middleware only looks for a
// cookie and cannot authorise; this can, and does.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (session === null) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  })

  return (
    <SidebarProvider>
      <AppSidebar userName={user?.name ?? ""} />
      <SidebarInset>
        {/* The inset padding is what keeps the sticky bar clear of a notch once
            this is installed to the home screen. In a browser tab the insets
            are zero and it costs nothing. */}
        <header className="sticky top-0 z-10 flex shrink-0 items-center border-b bg-background pt-[env(safe-area-inset-top)] pr-[max(--spacing(2),env(safe-area-inset-right))] pl-[max(--spacing(2),env(safe-area-inset-left))]">
          <div className="flex h-12 items-center">
            {/* The stock trigger carries an English screen-reader label. An
                aria-label from here overrides it without editing generated
                code — user-facing text is Italian (CLAUDE.md). */}
            <SidebarTrigger aria-label="Apri il menu" />
          </div>
        </header>
        <div className="mx-auto w-full max-w-2xl pr-[max(--spacing(4),env(safe-area-inset-right))] pb-[calc(--spacing(24)+env(safe-area-inset-bottom))] pl-[max(--spacing(4),env(safe-area-inset-left))]">
          {children}
        </div>
      </SidebarInset>
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}
