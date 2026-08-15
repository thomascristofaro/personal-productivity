import { redirect } from "next/navigation"

import { weekStartFor } from "@/lib/week"

// Without this, Next would render the redirect at build time and bake in
// whichever week was current when the deploy happened.
export const dynamic = "force-dynamic"

export default function ShoppingPage() {
  const weekStart = weekStartFor(new Date())
  redirect(`/spesa/${weekStart.toISOString().slice(0, 10)}`)
}
