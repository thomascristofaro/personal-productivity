# Authentication — design

**Status:** decided, 2026-08-15. Resolves the open mechanism of
`2026-08-13-menu-spesa-design.md` §6.4, which deferred the choice to "its own
investigation". That section's constraints still bind except where this document
says otherwise, and §6.4 and §9.2 have been amended to point here.

**Mechanism: Google sign-in through `better-auth`. No passwords anywhere in the
system.**

---

## 1. Why Google rather than passwords

§6.4 fixed two users, seeded, with no registration flow and no password reset UI.
Google satisfies that shape more directly than a password ever could: the
credential surface stops being ours.

What the choice removes outright, all of it listed in §6.4 or §9.2 as a
requirement _of the password mechanism_, not of authentication as such:

- argon2id hashing and `@node-rs/argon2`
- password provisioning for two seeded users, and the CLI reset it implied
- rate limiting the login endpoint by IP and by account (§9.2)
- generic failure messages and user enumeration (§9.2) — there is no endpoint of
  ours that can confirm whether an address is a user

What it costs, and these are real:

- **A dependency on Google being reachable to sign in.** Sessions already open
  survive: the cookie is `better-auth`'s own, with an expiry this project sets,
  independent of any Google token lifetime.
- **Setup outside the repository** — see §7.
- Two secrets more.

## 2. What does not change

- `User` carries identity. It gains the fields the adapter requires (§4) and
  nothing else; no existing column or row moves.
- **The rest of the application sees `requireSession()` and never learns what
  implements it.** The four server actions that import `@/lib/auth` are not
  touched by this work. That is the load-bearing property of §6.4 and it is kept
  literally.
- **Every server action still authenticates inside itself**, in the order
  validate → authenticate → authorise → mutate. Nothing below replaces that, and
  the route gate of §6 is explicitly not a substitute for it.

## 3. Who may sign in

Only a user that already exists in the database — that is, one of the two the
seed creates.

`disableSignUp: true` on the Google provider is the whole of the allowlist: it
permits an existing user to authenticate and refuses to create a new one. A
Google account that is not seeded completes the flow at Google and is then
rejected, having created nothing.

`accountLinking.trustedProviders: ["google"]` links a first sign-in to the seeded
`User` by email. Google verifies the addresses it asserts, which is what makes
linking on email safe here.

A `user.create.before` database hook rejecting an unlisted address is available
as a second barrier. It is **not** in scope for v1: `disableSignUp` already
closes the door, and a second mechanism that is never exercised is a liability
rather than defence in depth.

## 4. Data model

One migration. Three tables arrive — `session`, `account`, `verification` — owned
entirely by `better-auth`.

`User` gains exactly what the adapter requires and no more:

| Field           | Why                                            |
| --------------- | ---------------------------------------------- |
| `emailVerified` | required by the adapter; Google asserts it     |
| `updatedAt`     | required by the adapter                        |
| `image`         | optional in the adapter, nullable here, unused |

`User.id` stays `cuid()`. The `checkedItems` relation is untouched.

This is a deviation from §6.4's "Nothing else in the schema changes". It is not
avoidable: `modelName` and `fields` rename columns, they do not remove the
adapter's requirement that they exist. Three nullable-or-defaulted columns on a
two-row table is the smallest form the deviation can take.

No password column is used on `account`.

## 5. The interface

`lib/auth/` replaces the single `lib/auth.ts`. The import path `@/lib/auth` is
unchanged, so no caller moves.

| Export             | Contract                                         |
| ------------------ | ------------------------------------------------ |
| `requireSession()` | returns `Session`, throws `UnauthenticatedError` |
| `getSession()`     | returns `Session \| null`                        |

Two functions rather than one, because the two callers want opposite things: a
server action wants to fail loudly, and the layout wants to redirect. Collapsing
them would force the layout to catch an exception as control flow.

`Session` stays `{ userId: string }`. Nothing above this layer learns that Google
exists.

## 6. The session gate

**The middleware redirects; it does not authorise.**

`middleware.ts` checks only whether a session cookie is _present_ and sends a
request without one to `/login`. It performs no database read and validates
nothing. It exists so that a signed-out visitor lands on the login screen
promptly, and for no other reason.

Authorisation happens twice below it, both server-side:

1. the `(app)` layout calls `getSession()` and redirects when it is `null`
2. every server action calls `requireSession()`, as it already does

§6.4 is emphatic that a check in middleware, a layout or a page does not protect
a server action, because an action is a public endpoint. Keeping the middleware
deliberately incapable of authorising is what stops that line being quietly
untrue later.

## 7. Setup outside the repository

Done once by the owner, and the application cannot work until it is:

- a Google Cloud project with an OAuth 2.0 client
- authorised redirect URIs for `http://localhost:3000` and the production origin
- consent screen in **Testing**, with both addresses as test users — a private
  app of two people needs no Google verification
- `OWNER_EMAIL` and `PARTNER_EMAIL` set to the real Google addresses **before the
  first seed**. The seed currently carries `example.invalid` placeholders; with
  those left in place, nobody can sign in.

## 8. Environment

Four new variables, added to `.env.example`, to `lib/env.ts` and to Vercel:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, `PARTNER_EMAIL`.

`AUTH_SECRET` is a fifth name but not a new one: `.env.example` already
documents it, written for the hand-rolled cookie this document rules out. It is
reused as `better-auth`'s `secret` rather than replaced. It does need adding to
`lib/env.ts`, which validates only what is consumed and so does not know about it
yet.

The seed reads the two addresses from the environment instead of holding them as
constants, so real addresses never enter the repository.

## 9. The development bypass

**Kept, on the owner's decision**, having been told what it costs: a path that is
never exercised in development is a path whose defects are found in production.

It is narrowed in one way. The bypass applies only when there is no real session;
signing in locally takes precedence over it. The developer therefore pays nothing
by default and can exercise the real path whenever they choose, without a code
change.

Its shape is unchanged otherwise: production throws, and only a non-production
`NODE_ENV` can reach the fallback.

## 10. Sessions

`httpOnly`, `Secure`, `SameSite=Lax`, long expiry. §6.4 ties this to success
criterion 3 — the partner must not be asked to sign in repeatedly — and re-login
friction is a direct threat to the app being used at all.

`better-auth`'s own endpoint rate limiting is enabled with database storage,
because serverless functions share no memory. This is not the login rate limiting
of §9.2, which this design retires along with passwords; it protects the auth
endpoints from being hammered.

## 11. Verification

`testing.md` puts library internals in the list of things this project does not
test, and states that a test which needs a faked session means the layering is
wrong. This design therefore adds close to no unit-testable surface, and that is
the correct outcome rather than a gap.

It is verified by a written manual browser checklist, as every UI plan here is,
and the checklist is executed rather than merely written. It must cover at
minimum:

1. a signed-out visitor to any route lands on `/login`
2. signing in with a seeded address reaches the app as that user
3. **signing in with a Google account that is not seeded is refused, and creates
   no user row** — the security property this design rests on
4. the session survives a browser restart
5. signing out returns to `/login`, and the back button does not restore the app
6. a server action invoked without a session is refused

## 12. Deliberately not in scope

- password sign-in, in any form, including as a fallback
- registration, invitation and self-service password reset
- roles and permissions: two users, both trusted, and `actorId` already
  distinguishes them where it matters
- the `user.create.before` second barrier (§3)
- account unlinking, and any second provider
