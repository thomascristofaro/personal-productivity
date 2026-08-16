"use client"

import { Contrast } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// One icon and one fixed label in both themes. Rendering either from
// `resolvedTheme` would mean rendering nothing on the server and something else
// after mount, which is a hydration mismatch on every page.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cambia tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Contrast aria-hidden="true" />
    </Button>
  )
}
