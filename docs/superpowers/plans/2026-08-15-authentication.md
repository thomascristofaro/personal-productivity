# Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in to the app with Google, so that only the two seeded users can reach it and `main` can be deployed.

**Architecture:** `better-auth` owns sessions and the Google link; the application keeps seeing `requireSession()` and never learns what implements it. The middleware only redirects on a missing cookie — it authorises nothing. Authorisation stays server-side, in the `(app)` layout and in every server action.

**Tech Stack:** `better-auth`, Prisma 7 (`postgresql`), Next.js 16 App Router, Zod, shadcn/ui on Base UI.

**Spec:** [`docs/superpowers/specs/2026-08-15-authentication-design.md`](../specs/2026-08-15-authentication-design.md), which amends §6.4 and §9.2 of [`2026-08-13-menu-spesa-design.md`](../specs/2026-08-13-menu-spesa-design.md).

## Global Constraints

- **Italian for what the user reads.** UI labels, buttons, error messages, page titles. English for identifiers, comments, TSDoc, commit messages, test names.
- **Only a seeded user may sign in.** `disableSignUp: true` on the Google provider is the whole allowlist. This is the property the design rests on — if a task appears to require removing it, stop and report.
- **Every server action authenticates inside itself**, in the order validate → authenticate → authorise → mutate. The middleware and the layout are not substitutes.
- **No `process.env` outside `lib/env.ts`.** ESLint enforces it for `app/**`, `components/**`, `hooks/**` and `lib/**`. Read the validated `env`.
- **Never a real secret in the repository.** Names in `.env.example`, values in `.env` and in Vercel.
- **Import the shared client from `@/lib/db`.** Only `lib/db.ts` may construct a Prisma client.
- **`pnpm verify` is the gate**: `tsc --noEmit && eslint && vitest run`. Green before any commit.
- Prisma model names are `Session`, `Account`, `Verification` — the adapter reaches them as `prisma.session`, `prisma.account`, `prisma.verification`.
- Sessions: `httpOnly`, `Secure` in production, `SameSite=Lax`, long expiry. Re-login friction threatens success criterion 3.

## Before starting

Spec §7 — the Google Cloud OAuth client, the redirect URIs, and real addresses for `OWNER_EMAIL` / `PARTNER_EMAIL` — is the owner's, and on 2026-08-15 it was not done yet.

**It does not block Tasks 1 to 5.** The variables have to _exist_ from Task 1, because `lib/env.ts` validates at import and `lib/db.ts` imports it, but the schema only asks for a non-empty string and a well-formed address. Build with placeholders:

```
AUTH_SECRET=<generate a real one, it costs nothing>
GOOGLE_CLIENT_ID=placeholder.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=placeholder
OWNER_EMAIL=owner@example.invalid
PARTNER_EMAIL=partner@example.invalid
```

Those two addresses are the ones already in the database, chosen so that an accidental seed updates the existing rows instead of adding more.

What the placeholders cost: the Google flow cannot be exercised, so Task 4 can be built but not tried, and points 2 to 6 of the Task 6 checklist wait for the real credentials. Nothing else is affected.

**Do not run `pnpm db:seed` while the addresses are placeholders.** The seed upserts on email, so seeding twice with two different sets leaves four users. When the real addresses arrive, update the two existing rows in place rather than reseeding — their ids are referenced by `ShoppingListItem.checkedBy`.

---

## Task 1: Dependencies and environment

**Files:**

- Modify: `package.json`
- Modify: `lib/env.ts`
- Modify: `lib/env.test.ts`
- Modify: `.env.example`
- Modify: `prisma/seed.ts`
- Modify: `vitest.config.ts` — **missed when this plan was written.** `lib/env.ts` validates at import, and the test runner injects the environment there rather than reading `.env`; without the new names every test file that reaches `lib/env` fails to import. Found while executing Step 5.

**Interfaces:**

- Produces: `env.AUTH_SECRET`, `env.GOOGLE_CLIENT_ID`, `env.GOOGLE_CLIENT_SECRET`, `env.OWNER_EMAIL`, `env.PARTNER_EMAIL`, all `string`, all required.

- [x] **Step 1: Install better-auth**

```powershell
pnpm add better-auth
```

- [x] **Step 2: Write the failing test for the new environment variables**

Add to `lib/env.test.ts`, replacing the existing `valid` constant so every test carries the new variables:

```ts
const valid = {
  DATABASE_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
  DIRECT_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
  AUTH_SECRET: "3PMGhXcCBOD-0mn3Xh6h2rGV0lQnbnRLtQ4hVLLQ5Ks",
  GOOGLE_CLIENT_ID: "1234.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-not-a-real-secret",
  OWNER_EMAIL: "owner@gmail.com",
  PARTNER_EMAIL: "partner@gmail.com",
}
```

and these cases:

```ts
it("rejects a missing Google client id rather than starting without one", () => {
  const { GOOGLE_CLIENT_ID, ...rest } = valid
  expect(() => EnvSchema.parse(rest)).toThrow()
})

it("rejects a seeded address that is not an email", () => {
  expect(() => EnvSchema.parse({ ...valid, OWNER_EMAIL: "owner" })).toThrow()
})

it("rejects an auth secret too short to sign anything safely", () => {
  expect(() => EnvSchema.parse({ ...valid, AUTH_SECRET: "short" })).toThrow()
})
```

- [x] **Step 3: Run the tests and watch them fail**

```powershell
pnpm vitest run lib/env.test.ts
```

Expected: the three new cases fail, because `EnvSchema` ignores unknown keys and throws for none of them.

- [x] **Step 4: Extend the schema**

In `lib/env.ts`, add to `EnvSchema`:

```ts
  // 32 bytes base64url is 43 characters; anything shorter is not a key.
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // The two seeded users of design section 6.4. Read from the environment so
  // real addresses never enter the repository.
  OWNER_EMAIL: z.email(),
  PARTNER_EMAIL: z.email(),
```

- [x] **Step 5: Run the tests and watch them pass**

```powershell
pnpm vitest run lib/env.test.ts
```

Expected: PASS.

- [x] **Step 6: Document the names in `.env.example`**

Replace the `AUTH_SECRET` block with:

```
# Signs the session cookie. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
AUTH_SECRET=

# Google OAuth client. Create one at console.cloud.google.com, with authorised
# redirect URIs for http://localhost:3000/api/auth/callback/google and for the
# production origin. Consent screen in Testing, with both addresses below as
# test users — a private app of two people needs no Google verification.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# The two users the seed creates. These must be the real Google addresses:
# sign-up is disabled, so only an address seeded here can ever sign in.
OWNER_EMAIL=
PARTNER_EMAIL=
```

- [x] **Step 7: Read the seeded addresses from the environment**

In `prisma/seed.ts`, replace the `USERS` constant:

```ts
// The two fixed users of design document section 6.4. Addresses come from the
// environment, never from source: sign-up is disabled, so whatever is seeded
// here is exactly the set of people who can sign in.
const USERS = [
  { email: requiredEnv("OWNER_EMAIL"), name: "Thomas" },
  { email: requiredEnv("PARTNER_EMAIL"), name: "Partner" },
]
```

and add above it:

```ts
function requiredEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set. See .env.example.`)
  }
  return value
}
```

`prisma/` is outside the ESLint block that forbids `process.env`, and the seed runs before `lib/env.ts` would be worth loading.

- [x] **Step 8: Verify**

```powershell
pnpm verify
```

Expected: green.

- [x] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: require the authentication environment"
```

---

## Task 2: The data model

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_authentication/migration.sql` (generated)

**Interfaces:**

- Produces: Prisma models `Session`, `Account`, `Verification`, `RateLimit`; `User.emailVerified`, `User.image`, `User.updatedAt`, `User.sessions`, `User.accounts`.

- [x] **Step 1: Add the adapter's columns to `User`**

In `prisma/schema.prisma`, replace the `User` model:

```prisma
// Identity, plus the three columns better-auth's adapter requires. Credential
// and session storage belong to better-auth and live in the models below.
// See docs/superpowers/specs/2026-08-15-authentication-design.md section 4.
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  // Required by the adapter. Google asserts it, so it is true in practice.
  emailVerified Boolean  @default(false)
  // Required by the adapter, unused by this app.
  image         String?
  createdAt     DateTime @default(now())
  // @default(now()) as well as @updatedAt: the table already holds rows, and a
  // bare NOT NULL column cannot be added to them.
  updatedAt     DateTime @default(now()) @updatedAt

  checkedItems ShoppingListItem[]
  sessions     Session[]
  accounts     Account[]
}
```

- [x] **Step 2: Add better-auth's own models**

Append to `prisma/schema.prisma`:

```prisma
// The three models below are better-auth's core schema. Field names are fixed
// by the adapter — do not rename them without a matching `fields` mapping in
// lib/auth/better-auth.ts.
model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  // Unused: this app has no password sign-in.
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @default(now()) @updatedAt
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @default(now()) @updatedAt
}

// Rate limiting counters. Serverless functions share no memory, so the counter
// is persisted rather than held in the process — design section 10.
model RateLimit {
  id          String @id @default(cuid())
  key         String @unique
  count       Int
  lastRequest BigInt
}
```

These models are written from better-auth's documented core schema rather than generated, because the generator needs a config file that does not exist until Task 3. Task 3 Step 6 cross-checks them against it, and the generator wins any disagreement. Applying the migration locally first is safe; do not deploy it before that check has run.

- [x] **Step 3: Create and apply the migration**

Applied as `20260815085712_authentication`, without a reset prompt — the `@default(now())` on `updatedAt` is what made that possible on a table that already held two rows.

```powershell
pnpm db:migrate
```

Name it `authentication` when prompted.

Expected: it applies without prompting to reset. If Prisma asks to drop data, stop — something in Step 1 is wrong, most likely a `NOT NULL` column with no default on a table that already holds two rows.

- [x] **Step 4: Verify**

```powershell
pnpm verify
```

Expected: green.

**`pnpm db:migrate` did not regenerate the client**, contrary to what this step originally claimed. `tsc` passed anyway — nothing referenced the new models yet — and the gap only surfaced in Task 3, as `BetterAuthError: Model rateLimit does not exist in the database`. Run `pnpm db:generate` after the migration, and restart any dev server: the process holds the old client in memory, which is the same trap the roadmap records for `/spesa` on 2026-08-14.

- [x] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: add the authentication tables"
```

---

## Task 3: The better-auth instance and the session interface

**Files:**

- Delete: `lib/auth.ts`
- Create: `lib/auth/better-auth.ts`
- Create: `lib/auth/index.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Modify: `eslint.config.mjs:181`
- Modify: `lib/env.ts`, `lib/env.test.ts`, `vitest.config.ts`, `.env.example` — for `APP_URL`, added here rather than in Task 1 because the CLI run in Step 6 is what surfaced the need for it

**Interfaces:**

- Consumes: `env` from Task 1, `db`, the models from Task 2.
- Produces: `auth` (the better-auth instance) from `@/lib/auth/better-auth`; and from `@/lib/auth`, unchanged for existing callers: `requireSession(): Promise<Session>`, `UnauthenticatedError`, `type Session = { userId: string }`; new: `getSession(): Promise<Session | null>` and `getVerifiedSession(): Promise<Session | null>`.

**The two getters are not interchangeable.** `getVerifiedSession()` reports only a session better-auth actually issued. `getSession()` reports who the app should treat as the current user, which in development includes the seeded fallback. The login screen must use the verified one: asking `getSession()` there would see the fallback, redirect to the app, and bounce back off the middleware forever.

- [x] **Step 1: Create the instance**

`baseURL: env.APP_URL` is in the real file and not in the snippet below: the CLI's warning in Step 6 is what put it there. Without it better-auth derives the origin from the incoming request, and the redirect URI it sends to Google would depend on proxy headers.

`lib/auth/better-auth.ts`:

```ts
import "server-only"

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

const DAY = 60 * 60 * 24

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // The entire allowlist. An existing user may authenticate; nobody new is
      // ever created, so only the two seeded addresses can get in. Removing
      // this opens the app to every Google account there is.
      disableSignUp: true,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      // Google verifies the addresses it asserts, which is what makes linking a
      // first sign-in to the seeded user by email safe.
      trustedProviders: ["google"],
    },
  },

  session: {
    // Ninety days. Re-login friction threatens success criterion 3 directly.
    expiresIn: DAY * 90,
    updateAge: DAY,
  },

  rateLimit: {
    enabled: true,
    // Serverless functions share no memory, so the counter is persisted.
    storage: "database",
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },

  // Must stay last: it is what lets a server action set the cookie.
  plugins: [nextCookies()],
})
```

- [x] **Step 2: Create the app-facing interface**

`lib/auth/index.ts`:

```ts
import "server-only"

import { headers } from "next/headers"

import { auth } from "@/lib/auth/better-auth"
import { db } from "@/lib/db"
import { env } from "@/lib/env"

export type Session = { userId: string }

export class UnauthenticatedError extends Error {
  constructor() {
    super("No active session.")
    this.name = "UnauthenticatedError"
  }
}

// Development convenience, kept deliberately — see design section 9. It applies
// only when there is no real session, so signing in locally exercises the real
// path without a code change, and it cannot be reached in production.
async function developmentFallback(): Promise<Session | null> {
  if (env.NODE_ENV === "production") return null

  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  return user === null ? null : { userId: user.id }
}

/**
 * Returns the session better-auth issued, or null when there is none.
 *
 * The development fallback is deliberately not applied. The login screen asks
 * this one: were it to ask getSession(), it would see the fallback in
 * development, redirect to the app, and bounce back off the middleware.
 *
 * @returns The verified session, or null.
 */
export async function getVerifiedSession(): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session === null ? null : { userId: session.user.id }
}

/**
 * Returns who the app should treat as the current user, or null.
 *
 * For callers that redirect rather than fail — the app layout. A server action
 * wants requireSession() instead. In development this falls back to the first
 * seeded user; in production it is exactly getVerifiedSession().
 *
 * @returns The session of the current user, or null.
 */
export async function getSession(): Promise<Session | null> {
  return (await getVerifiedSession()) ?? developmentFallback()
}

/**
 * Returns the current session, or throws if there is none.
 *
 * @returns The session of the authenticated user.
 * @throws UnauthenticatedError when no session can be resolved.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (session === null) throw new UnauthenticatedError()
  return session
}
```

- [x] **Step 3: Delete the old file**

```powershell
git rm lib/auth.ts
```

The four server actions import `@/lib/auth`, which now resolves to `lib/auth/index.ts`. None of them changes.

- [x] **Step 4: Mount the auth endpoints**

Verified live: `GET /api/auth/get-session` answers `200 null`, and `POST /api/auth/sign-in/social` with `{"provider":"google"}` returns a Google authorization URL carrying `redirect_uri=http://localhost:3000/api/auth/callback/google` — which is the URI to register in the Google Cloud client.

`app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth/better-auth"

export const { GET, POST } = toNextJsHandler(auth)
```

- [x] **Step 5: Keep the ESLint layering honest**

In `eslint.config.mjs`, the `lib/*.ts` block ignores `lib/auth.ts`, which no longer exists. The glob matches only direct children of `lib/`, so `lib/auth/**` is outside it either way — but leave the intent written down rather than a dead entry. Replace:

```js
  {
    // Leaf modules, per the table in docs/conventions/architecture.md: reachable
    // from components/**, so they obey the same restrictions as lib/services/**.
    // lib/auth/** is deliberately outside this block: it is the framework
    // boundary and must reach next/headers.
    files: ["lib/*.ts"],
    ignores: ["lib/db.ts", "lib/env.ts", "lib/env.test.ts"],
```

- [x] **Step 6: Cross-check the generated schema**

Now that the config file exists, run the check deferred from Task 2:

```powershell
pnpm dlx @better-auth/cli@latest generate --config lib/auth/better-auth.ts --output .better-auth-generated.prisma --yes
```

**The CLI refuses a config it cannot resolve, and `import "server-only"` stops it — in `lib/auth/better-auth.ts`, and also in `lib/db.ts` and `lib/env.ts`, which it reaches through the import graph.** Remove the three lines, run it, put them back, and check `git diff` afterwards to be sure all three returned.

Result on 2026-08-15: the generator agreed field for field. The only difference is `@@map` to lowercase table names, which is what a fresh install would produce — irrelevant here, because the adapter goes through the Prisma client rather than SQL, and adopting it would rename the existing `User` table. Schema left as written; delete the generated file.

The run also warned that `baseURL` was unset, which is why `APP_URL` exists — see Step 1.

- [x] **Step 7: Verify**

```powershell
pnpm verify
```

Expected: green.

- [x] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: add the better-auth instance behind requireSession"
```

---

## Task 4: The login screen

**Files:**

- Create: `lib/auth-client.ts`
- Create: `app/login/page.tsx`
- Create: `components/auth/google-sign-in.tsx`
- Create: `components/auth/sign-out.tsx`
- Modify: `components/app-sidebar.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**

- Consumes: `getSession()` from Task 3.
- Produces: `authClient` from `@/lib/auth-client`; `<GoogleSignIn />`; `<SignOut />`.

`components/**` may not import `@/lib/auth` — ESLint's `noServerCode` list forbids it. The browser talks to `@/lib/auth-client`, which is why it is a separate module rather than another export of `lib/auth/`.

- [ ] **Step 1: Create the browser client**

`lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react"

// No baseURL: the client and the API share an origin.
export const authClient = createAuthClient()
```

- [ ] **Step 2: Create the sign-in button**

`components/auth/google-sign-in.tsx`:

```tsx
"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function GoogleSignIn() {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          const { error } = await authClient.signIn.social({
            provider: "google",
            callbackURL: "/menu",
          })
          // On success the browser has already left for Google, so reaching
          // here at all means it did not start.
          if (error !== null) {
            setFailed(true)
            setPending(false)
          }
        }}
      >
        {pending ? "Apro Google…" : "Accedi con Google"}
      </Button>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Non è stato possibile aprire l’accesso Google. Riprova.
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Create the login page**

`app/login/page.tsx`. It sits outside `(app)` on purpose: no sidebar, no shell, nothing to navigate to.

```tsx
import { redirect } from "next/navigation"

import { GoogleSignIn } from "@/components/auth/google-sign-in"
import { getVerifiedSession } from "@/lib/auth"

export const metadata = { title: "Accedi" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ negato?: string }>
}) {
  // Verified, not getSession(): in development the fallback would send every
  // visit straight back to the app, and signing in locally would be impossible.
  if ((await getVerifiedSession()) !== null) redirect("/menu")

  const { negato } = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Menù e spesa</h1>
        <p className="text-sm text-muted-foreground">
          L’accesso è riservato a due account.
        </p>
      </div>

      {negato === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          Questo account Google non è abilitato.
        </p>
      )}

      <GoogleSignIn />
    </main>
  )
}
```

- [ ] **Step 4: Create the sign-out button**

`components/auth/sign-out.tsx`:

```tsx
"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { SidebarMenuButton } from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"

export function SignOut() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <SidebarMenuButton
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signOut()
        // refresh() as well as push(): without it the server components of the
        // page just left stay in the router cache.
        router.push("/login")
        router.refresh()
      }}
    >
      <LogOut aria-hidden="true" />
      <span>{pending ? "Esco…" : "Esci"}</span>
    </SidebarMenuButton>
  )
}
```

- [ ] **Step 5: Put the user and the way out in the sidebar**

In `components/app-sidebar.tsx`, add the imports:

```tsx
import { SignOut } from "@/components/auth/sign-out"
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
```

Take the name as a prop, because a client component cannot read the session:

```tsx
export function AppSidebar({ userName }: { userName: string }) {
```

and add, immediately before the closing `</Sidebar>`:

```tsx
<SidebarFooter>
  <SidebarMenu>
    <SidebarMenuItem>
      <span className="px-2 text-xs text-muted-foreground">{userName}</span>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SignOut />
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
```

- [ ] **Step 6: Feed the name from the layout**

In `app/(app)/layout.tsx`, make it async and read the user. The redirect itself lands in Task 5; here the layout only needs the name:

```tsx
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

// This layout stays a server component: SidebarProvider is a client component,
// but `children` is passed to it as a slot, so the pages below keep rendering
// on the server.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (session === null) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  })

  return (
    <SidebarProvider>
      <AppSidebar userName={user?.name ?? ""} />
```

Leave the rest of the file as it is.

- [ ] **Step 7: Verify**

```powershell
pnpm verify
```

Expected: green.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: sign in with Google and sign out again"
```

---

## Task 5: The gate

**Files:**

- Create: `middleware.ts`

**Interfaces:**

- Consumes: nothing of ours. `getSessionCookie` comes from `better-auth/cookies`.

- [ ] **Step 1: Write the middleware**

`middleware.ts`, at the repository root:

```ts
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
```

- [ ] **Step 2: Check the matcher against a production build**

The middleware stands down in development, so `pnpm dev` cannot show this. Build and run locally in production mode:

```powershell
pnpm build
pnpm start
```

`app/page.tsx` exists at `/`, and an unauthenticated visitor arriving there must land on `/login` rather than see it. In a private window open `http://localhost:3000/` and confirm the address bar ends at `/login`. Then confirm `/login` itself renders rather than looping, and that a stylesheet loads — a matcher that swallows `_next/static` shows an unstyled page.

Stop `pnpm start` afterwards.

Signing in locally still works during ordinary `pnpm dev`: navigate to `/login` directly. The middleware will not send you there, but the screen works, and `getVerifiedSession()` means it does not bounce you back.

- [ ] **Step 3: Verify**

```powershell
pnpm verify
```

Expected: green.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: send a visitor without a session to the login screen"
```

---

## Task 6: Design review and the manual checklist

**Files:**

- Modify: whatever the review finds
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run the guidelines**

Use `.agents/skills/web-design-guidelines/` over:

```
app/login/page.tsx
components/auth/google-sign-in.tsx
components/auth/sign-out.tsx
components/app-sidebar.tsx
app/(app)/layout.tsx
```

- [ ] **Step 2: Triage**

Fix focus order, keyboard reachability, labels, live regions, contrast, heading structure. Park anything cosmetic in the roadmap rather than fixing it here.

- [ ] **Step 3: Manual browser check**

At 390px. Executed, not merely written — it can be driven through the `playwright` MCP server. **The development fallback of §9 hides most of what this checklist tests**, so it runs against a local production build.

**Points 2 to 6 need real Google credentials.** If the build was done against the placeholders of "Before starting", run point 1 and point 7 now, leave the rest unticked, and record in the roadmap that the checklist is part-run and why — the same debt three plans carried on 2026-08-14, so name it rather than let it go quiet.

Points 1 to 6 need the middleware, which stands down in development: run them against `pnpm build && pnpm start`, not `pnpm dev`.

1. Signed out, open `/menu`, `/spesa`, `/recipes`, `/ingredients` and `/` in turn: each lands on `/login`.
2. Sign in with a seeded address: you reach `/menu` as that user, and the sidebar footer shows the right name.
3. **Sign in with a Google account that is not seeded: it is refused, and no `User` row is created.** Check the row count before and after. This is the property the whole design rests on — if it fails, stop and report rather than working around it.
4. Close the browser entirely, reopen it, open `/menu`: still signed in.
5. "Esci" returns to `/login`, and the browser back button does not show the app again.
6. With the browser signed out, invoke a server action directly (an unauthenticated `POST` to a page that hosts one) and confirm it is refused rather than mutating.
7. The login screen at 390px: no horizontal scroll, the button reaches at least 44px of touch target, and the whole flow works one-handed.

- [ ] **Step 4: Update the roadmap**

Move authentication from "Not started" to "Shipped", with what it left behind. Record the deployment prerequisite that remains: the production redirect URI must exist in the Google Cloud client before `main` is deployed.

- [ ] **Step 5: Verify**

```powershell
pnpm verify
```

Expected: green.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "docs: record authentication as shipped"
```
