"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { Input } from "@/components/ui/input"

export function RecipeSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get("q") ?? "")
  const [isPending, startTransition] = useTransition()

  // Typing should not push a history entry per keystroke, and should not fetch
  // per keystroke either.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = value.trim()
      const target =
        next === "" ? "/recipes" : `/recipes?q=${encodeURIComponent(next)}`
      startTransition(() => router.replace(target, { scroll: false }))
    }, 250)

    return () => clearTimeout(timer)
  }, [value, router])

  return (
    <Input
      type="search"
      name="q"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Cerca una ricetta…"
      aria-label="Cerca una ricetta"
      data-pending={isPending ? "" : undefined}
      className="w-full"
    />
  )
}
