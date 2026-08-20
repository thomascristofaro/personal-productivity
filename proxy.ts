import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Was middleware.ts until 2026-08-19. Next 16 deprecated that convention and
// renamed it `proxy`, which also means the file no longer has a runtime to
// choose: `proxy` is always nodejs, and the edge runtime is not available to it.
// Nothing here wanted edge — better-auth's cookie reader is plain JavaScript.
//
// This redirects; it does not authorise. It reads whether a cookie is present
// and nothing else — no database, no signature check. Authorisation happens
// server-side, in the (app) layout and inside every server action, because a
// server action is a public endpoint that no route gate can protect.
// See docs/superpowers/specs/2026-08-15-authentication-design.md section 6.
export function proxy(request: NextRequest) {
  // Development keeps the fallback session of design section 9, and the owner's
  // decision is that local work does not sign in. Redirecting here would make
  // that fallback unreachable — every page would bounce to a login screen the
  // fallback exists precisely to avoid. NODE_ENV is inlined at build time, so
  // this branch is not present in a production build.
  if (process.env.NODE_ENV !== "production") return NextResponse.next()

  if (getSessionCookie(request) !== null) return NextResponse.next()

  // Carrying the address through: without it a shared recipe dies at the login
  // screen — you sign in, land on /menu, and the link you were importing is
  // gone. /login checks it before using it, because an unchecked `next` is an
  // open redirect.
  const login = new URL("/login", request.url)
  login.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search
  )
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except the auth endpoints, the login screen itself, and the
  // static assets that would otherwise pay for a redirect they cannot use.
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
}
