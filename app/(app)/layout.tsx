import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"

// This layout stays a server component: SidebarProvider is a client component,
// but `children` is passed to it as a slot, so the pages below keep rendering
// on the server.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background px-2">
          {/* The stock trigger carries an English screen-reader label. An
              aria-label from here overrides it without editing generated
              code — user-facing text is Italian (CLAUDE.md). */}
          <SidebarTrigger aria-label="Apri il menu" />
        </header>
        <div className="mx-auto w-full max-w-2xl px-4 pb-24">{children}</div>
      </SidebarInset>
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}
