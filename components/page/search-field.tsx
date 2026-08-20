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
  const fromUrl = searchParams.get(param) ?? ""
  const [value, setValue] = useState(fromUrl)
  const [isPending, startTransition] = useTransition()

  // The URL as this box last saw it, so a change can be told from a re-render.
  const [seen, setSeen] = useState(fromUrl)
  // The query this box last asked the URL for. Written when the replace is
  // scheduled, which is before it lands — that gap is the whole point, and it
  // is why `seen` cannot do this job too. Not in the effect's dependencies, so
  // writing it never restarts the debounce that scheduled it.
  const [requested, setRequested] = useState(fromUrl)

  if (fromUrl !== seen) {
    setSeen(fromUrl)
    // The URL moved to something this box never asked for — a Back, or a link
    // carrying a different query. The URL is then the truth: what the box holds
    // was typed for the entry we just left, and leaving it there makes the
    // effect below push it straight back, which is Back appearing not to work.
    // Compared against what was requested rather than against `value`, because
    // a replace can land after more has been typed and must not swallow those
    // keystrokes. Adjusting own state during render is what React prescribes
    // here; an effect would paint the stale value first.
    if (fromUrl !== requested) {
      setRequested(fromUrl)
      setValue(fromUrl)
    }
  }

  // Typing should not push a history entry per keystroke, and should not fetch
  // per keystroke either.
  useEffect(() => {
    const next = value.trim()
    // Landing on the page leaves `value` matching the URL already — without
    // this guard that still schedules a no-op replace, re-fetching the RSC
    // payload for nothing.
    if (next === fromUrl) return

    const timer = setTimeout(() => {
      // Every other param survives the search, the way the chips survive it.
      const params = new URLSearchParams(searchParams)
      if (next === "") params.delete(param)
      else params.set(param, next)
      const search = params.toString()
      setRequested(next)
      startTransition(() =>
        router.replace(search === "" ? basePath : `${basePath}?${search}`, {
          scroll: false,
        })
      )
    }, 250)

    return () => clearTimeout(timer)
  }, [value, fromUrl, router, searchParams, basePath, param])

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
