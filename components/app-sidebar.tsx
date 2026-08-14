"use client"

import { BookOpen, CalendarDays, Carrot, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Adding a module to the app is one entry here. The order is the one the two
// users think in, not alphabetical.
const NAV_ITEMS = [
  { href: "/menu", label: "Menù", icon: CalendarDays },
  { href: "/spesa", label: "Spesa", icon: ShoppingCart },
  { href: "/recipes", label: "Ricettario", icon: BookOpen },
  { href: "/ingredients", label: "Ingredienti", icon: Carrot },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 text-sm font-semibold">
        Menù e spesa
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    }
                    render={<Link href={item.href} />}
                    // On a phone the sidebar is a sheet over the page; without
                    // this it stays open on top of the page just navigated to.
                    onClick={() => setOpenMobile(false)}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
