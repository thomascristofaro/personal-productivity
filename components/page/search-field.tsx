"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { Input } from "@/components/ui/input"

export function SearchField({
  basePath,
  placeholder,
  label,
  param = "q",
}: {
  basePath: string
  placeholder: string
  label: string
  param?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get(param) ?? "")
  const [isPending, startTransition] = useTransition()

  // Typing should not push a history entry per keystroke, and should not fetch
  // per keystroke either.
  useEffect(() => {
    const next = value.trim()
    // Landing on the page leaves `value` matching the URL already — without
    // this guard that still schedules a no-op replace, re-fetching the RSC
    // payload for nothing.
    if (next === (searchParams.get(param) ?? "")) return

    const timer = setTimeout(() => {
      // Every other param survives the search, the way the chips survive it.
      const params = new URLSearchParams(searchParams)
      if (next === "") params.delete(param)
      else params.set(param, next)
      const search = params.toString()
      startTransition(() =>
        router.replace(search === "" ? basePath : `${basePath}?${search}`, {
          scroll: false,
        })
      )
    }, 250)

    return () => clearTimeout(timer)
  }, [value, router, searchParams, basePath, param])

  return (
    <Input
      type="search"
      name={param}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      data-pending={isPending ? "" : undefined}
      className="w-full"
    />
  )
}
