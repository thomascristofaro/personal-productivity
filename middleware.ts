import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// This redirects; it does not authorise. It reads whether a cookie is present
// and nothing else — no database, no signature check. Authorisation happens
// server-side, in the (app) layout and inside every server action, because a
// server action is a public endpoint that no route gate can protect.
// See docs/superpowers/specs/2026-08-15-authentication-design.md section 6.
export function middleware(request: NextRequest) {
  // Development keeps the fallback session of design section 9, and the owner's
  // decision is that local work does not sign in. Redirecting here would make
  // that fallback unreachable — every page would bounce to a login screen the
  // fallback exists precisely to avoid. NODE_ENV is inlined at build time, so
  // this branch is not present in a production build.
  if (process.env.NODE_ENV !== "production") return NextResponse.next()

  if (getSessionCookie(request) !== null) return NextResponse.next()

  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  // Everything except the auth endpoints, the login screen itself, and the
  // static assets that would otherwise pay for a redirect they cannot use.
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
}
