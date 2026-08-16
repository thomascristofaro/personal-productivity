import { createAuthClient } from "better-auth/react"

// Here rather than in lib/: `better-auth/react` exports React hooks, and the
// domain layer must not know about React (docs/conventions/architecture.md).
// better-auth's own docs put this in lib/auth-client.ts; the project's layering
// binds over the library's convention.
//
// No baseURL: the browser and the API share an origin, and the server pins its
// own through env.APP_URL.
export const authClient = createAuthClient()
