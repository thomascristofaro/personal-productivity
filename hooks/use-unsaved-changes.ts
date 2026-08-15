"use client"

import { useEffect } from "react"

const MESSAGE = "Hai modifiche non salvate. Vuoi uscire e perderle?"

/**
 * Asks for confirmation before a navigation that would discard a half-filled
 * form.
 *
 * Two escapes have to be covered separately, because they are different events:
 * leaving the document at all (reload, closing the tab) is `beforeunload`, and
 * following a link inside the app never reaches it — that navigation is
 * client-side. A link marked `data-discard` is left alone: Annulla already says
 * what it does, and asking twice is noise.
 *
 * @param dirty - whether the form holds edits that have not been saved
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // The wording is the browser's own and cannot be set; assigning
      // returnValue is only what asks for a prompt at all.
      event.preventDefault()
      event.returnValue = ""
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      // A modified click opens a new tab, so this one is not going anywhere.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const link = (event.target as Element | null)?.closest("a[href]")
      if (!(link instanceof HTMLAnchorElement)) return
      if (link.dataset.discard !== undefined) return
      if (link.target !== "" && link.target !== "_self") return
      if (link.origin !== window.location.origin) return
      if (link.href === window.location.href) return

      if (!window.confirm(MESSAGE)) event.preventDefault()
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    // Capture, because Next's Link acts on the bubble phase: a listener there
    // would run once the navigation had already been started.
    document.addEventListener("click", onClick, true)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])
}
