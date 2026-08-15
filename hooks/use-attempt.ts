"use client"

import { useState } from "react"

/**
 * Counts how many results a `useActionState` action has produced.
 *
 * The forms feed `state.values` into `defaultValue` to survive React 19's reset
 * of an uncontrolled form on submit. That changes a `defaultValue` after mount,
 * which is precisely what Base UI warns about. Keying the fields on this
 * counter remounts them instead, so each refusal hands them a fresh initial
 * value rather than mutating an existing one.
 *
 * @param state - the state object `useActionState` returns; a new identity per result
 * @returns a number that increases by one every time that identity changes
 */
export function useAttempt(state: unknown): number {
  const [seen, setSeen] = useState(state)
  const [attempt, setAttempt] = useState(0)

  // Adjusting state during render rather than in an effect: React re-runs the
  // component before committing, so the fields never render with a stale key.
  if (seen !== state) {
    setSeen(state)
    setAttempt((count) => count + 1)
  }

  return attempt
}
