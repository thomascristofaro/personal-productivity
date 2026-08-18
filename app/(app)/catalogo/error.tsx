"use client"

import { PageError } from "@/components/page/page-error"

// `"use client"` stays here even though PageError carries its own: Next
// requires an error boundary file to be a client component regardless.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError reset={reset} />
}
