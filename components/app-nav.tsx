"use client"

import { House, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { SignOut } from "@/components/auth/sign-out"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
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
// The pair on the right of both rows. Whatever sits here has to sit in both,
// or the icons jump sideways the moment the panel opens.
const ACTIONS = "flex items-center gap-1"

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
          <div className={ACTIONS}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Home"
              render={<Link href="/" />}
              nativeButton={false}
            >
              <House aria-hidden="true" />
            </Button>
            <ThemeToggle />
          </div>
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
          <div className={ACTIONS}>
            {/* Styled with buttonVariants rather than rendered into a Button:
                this one has to close the panel as well as navigate, and
                SheetClose already owns the element's render prop. */}
            <SheetClose
              render={<Link href="/" />}
              nativeButton={false}
              aria-label="Home"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <House aria-hidden="true" />
            </SheetClose>
            <ThemeToggle />
          </div>
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
