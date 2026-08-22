"use client"

import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { SignOut } from "@/components/auth/sign-out"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { activeHrefIn, navGroupsFor, type AppModule } from "@/lib/modules"
import { cn } from "@/lib/utils"

// The bar and the panel share one row: same height, same padding, same theme
// toggle, and the trigger swaps between the hamburger and the close. Opening
// the menu then reads as the icon changing rather than the page moving.
const ROW = "flex h-14 items-center justify-between gap-2 px-2"
const TRIGGER = "gap-2 px-2 text-base font-medium"

// The name and the modules arrive as props: this is a client component, so it
// can neither read the session nor ask the database which accounts exist. The
// layout above it does both.
export function AppNav({
  userName,
  modules,
  isOwner = false,
}: {
  userName: string
  modules: readonly AppModule[]
  isOwner?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const groups = navGroupsFor(modules, isOwner)
  const activeHref = activeHrefIn(
    groups.flatMap((group) => group.items),
    pathname
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* The inset padding is what keeps the sticky bar clear of a notch once
          this is installed to the home screen. In a browser tab the insets are
          zero and it costs nothing. */}
      <header className="sticky top-0 z-40 shrink-0 border-b bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <div className={ROW}>
          <SheetTrigger
            render={<Button variant="ghost" className={TRIGGER} />}
            aria-label="Apri il menu"
          >
            <Menu aria-hidden="true" />
            Menu
          </SheetTrigger>
          <ThemeToggle />
        </div>
      </header>

      <SheetContent
        side="top"
        showCloseButton={false}
        className="data-[side=top]:h-dvh data-[side=top]:overflow-y-auto data-[side=top]:bg-background data-[side=top]:pt-[env(safe-area-inset-top)] data-[side=top]:pr-[env(safe-area-inset-right)] data-[side=top]:pb-[env(safe-area-inset-bottom)] data-[side=top]:pl-[env(safe-area-inset-left)]"
      >
        <SheetTitle className="sr-only">Navigazione</SheetTitle>

        <div className={ROW}>
          <SheetClose
            render={<Button variant="ghost" className={TRIGGER} />}
            aria-label="Chiudi il menu"
          >
            <X aria-hidden="true" />
            Menu
          </SheetClose>
          <ThemeToggle />
        </div>

        <nav className="flex flex-col gap-8 px-6 py-10">
          {groups.map((group, index) => (
            <div key={group.title ?? index}>
              <p className="pb-4 text-xs text-muted-foreground">
                {group.title ?? "Menu"}
              </p>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const isActive = item.href === activeHref

                  return (
                    <li key={item.href}>
                      <SheetClose
                        render={<Link href={item.href} />}
                        // A link is not a button, and Base UI wants to be told:
                        // without this it warns and applies button semantics to
                        // an anchor.
                        nativeButton={false}
                        // isActive only styles. Without this the highlight
                        // exists for the eye and for nothing else.
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-md py-2 text-3xl font-medium tracking-tight transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {item.label}
                      </SheetClose>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div>
            <p className="pb-4 text-xs text-muted-foreground">Account</p>
            <p className="truncate pb-2 text-base">{userName}</p>
            <SignOut />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
