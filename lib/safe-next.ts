/**
 * Where to send a user after they sign in.
 *
 * Only a relative path of our own is accepted. An unchecked `next` is an open
 * redirect, and a login screen is the worst place in an application to have
 * one — `//evil.example` and `https://evil.example` are both absolute, and the
 * first one looks relative.
 *
 * @param next - whatever arrived in the query string
 * @returns the path to return to, or /menu when there is nothing safe to use
 */
export function safeNext(next: string | undefined): string {
  if (next === undefined) return "/menu"
  if (!next.startsWith("/") || next.startsWith("//")) return "/menu"
  return next
}
