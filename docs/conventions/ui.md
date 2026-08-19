# UI conventions

Only what is specific to this project. General craft — accessibility, layout,
interaction, performance — is not repeated here: it comes from the skills listed
at the bottom, which are more complete and stay maintained.

## shadcn/ui is the only component library

Binding (design document §4.3).

- The project is already initialised: `components.json`, style `base-maia`, base
  colour `olive`, theme `lime`, `rsc: true`. **Do not re-run `init`.** The theme
  is changed only by applying a preset the owner has chosen on
  `ui.shadcn.com/create`, never by editing the CSS variables by hand — the
  variables are the preset's output, and a hand edit is lost at the next one.
- Applying a preset rewrites every component in `components/ui/`. That is safe
  only while they stay stock; the rule below is what keeps it safe. On
  2026-08-16, `apply b3RYqbJZY` replaced `base-mira`/`mist`/`teal` and cost
  nothing, because `add --diff` reported no local change in any of the 19.
- Add components one at a time: `pnpm dlx shadcn@latest add <component>`. They land
  in `components/ui/` and become project source.
- Need a behaviour change? Edit the file in `components/ui/` directly. Do not wrap
  it in an adapter to avoid touching it — that leaves two places to look and one
  of them lies.
- Component missing from shadcn? Compose it from existing primitives inside
  `components/`. Do not install another library, do not hand-write a base
  component.

Expected set for the first module: `button`, `input`, `textarea`, `card`,
`dialog`, `drawer`, `sheet`, `checkbox`, `select`, `command`, `field`,
`tabs`, `badge`, `separator`, `skeleton`, `sonner`, `alert-dialog`.

Forms are built from `field` — `FieldGroup`, `Field`, `FieldLabel`,
`FieldDescription` — not from a `form` component and not from a `div` with
`space-y-*`. An earlier revision of this list named `form` and `label`; that
predates this installation's style, which has no `form` component.

**This installation is built on Base UI, not Radix.** Almost every shadcn example
online is written against Radix, so prop names and composition patterns do not
always transfer. Read `.agents/skills/shadcn/rules/base-vs-radix.md` rather
than adapting a blog post by guesswork.

## Page primitives

A page is assembled from `components/page/`, not rebuilt. A new module gets its
screens right by reusing these, and the states below stop being something each
module has to remember.

| Primitive                         | Use                                                |
| --------------------------------- | -------------------------------------------------- |
| `PageHeader`                      | title, optional back link, optional action slot    |
| `DataList` + `DataListRow`        | the card-row list, including the count live region |
| `EmptyState`                      | "there is nothing here", with an optional action   |
| `PageError`                       | the body of a route's `error.tsx`                  |
| `ListSkeleton` / `DetailSkeleton` | the body of a route's `loading.tsx`                |

**Every screen that fetches has four designed states, not three.** The design
document says loading, empty and error; use showed a fourth that is easy to miss.

1. **Empty** — nothing exists yet. Say so and offer the action that creates one.
2. **Filtered empty** — data exists, the filter matched nothing. Different copy,
   and no "create" button: the user is looking for something, not authoring.
3. **Error** — the fetch failed. `PageError`. Never a partial page.
4. **Loading** — `ListSkeleton` or `DetailSkeleton` in the route's `loading.tsx`.

States 1 and 2 are two call sites passing different strings to `EmptyState`, not
one component with a boolean. Adding an `isSearching`-style prop to a primitive
is the thing this directory exists to prevent.

`DataList` takes a `renderItem` callback. That is a render prop and it is the
right one: the parent supplies the data the child renders, the case
`vercel-composition-patterns` names as appropriate for them.

The catalogue screens under `app/(app)/ingredients/` are the second module built
on these, and they added no primitive and changed none. That is the bar: if a
third module needs one bent, bend the primitive rather than forking it.

## The app shell

`app/(app)/layout.tsx` mounts `components/app-nav.tsx`: a sticky bar carrying
the hamburger, the word "Menu" and the theme toggle, and behind it a `sheet`
that opens to the full screen. The layout stays a server component — `AppNav` is
a client component, but it sits beside `children` rather than around it, so
pages below keep rendering on the server.

**One navigation, every width.** The desktop rail was removed on 2026-08-16: the
owner's use is phone and tablet, and two behaviours to maintain bought nothing.
`components/ui/sidebar.tsx` and `hooks/use-mobile.ts` went with it.

Adding a module to the navigation is one entry in `NAV_ITEMS` in
`components/app-nav.tsx`. Only routes that exist are listed; a nav entry that
404s is worse than a short menu.

Generated shadcn code that ships English screen-reader text is not edited.
Override it from the call site instead — `aria-label="Apri il menu"` on the
trigger — so the file stays byte-identical to the registry.

The theme is switched from the bar and nowhere else. A keyboard shortcut existed
until 2026-08-16 and was removed with the toggle's arrival: one way in is enough,
and a bare letter key is a trap on a page with fields.

## Server and client

Server component by default. Add `"use client"` only for state, effects, event
handlers or browser APIs, and push it as far down the tree as possible.

A client component never imports from `lib/services/`. Data arrives as props from
a server component, or through a server action.

This decision constrains how components compose: prefer passing `children` from a
server component over a Context provider, because a provider is itself a client
component and pulls the boundary upward. Use Context only for genuinely shared
interactive state.

## Product decisions

- **Phone first, desktop tolerable.** Design at 390px wide and let it grow. On
  small viewports prefer `drawer` (bottom sheet) over `dialog`: thumbs reach the
  bottom of the screen, not a centred modal's corner.
- **Touch targets: the shadcn scale, unmodified.** The design document asked for
  44px, reasoning about shopping-list checkboxes tapped one-handed while holding
  a basket (§4.3). The style generates a 28px scale instead, and we
  take it as it comes: staying stock keeps every component upgradeable and keeps
  the diff against the registry empty. This is a deliberate trade-off, made
  before real use rather than after it. Revisit it the first time someone
  mis-taps something on a phone — the fix is then to edit the size variants in
  `components/ui/` in place, which is what owning the source is for.
- **Every screen that fetches has four designed states**, enumerated under "Page
  primitives" above. The menu and the shopping list start empty every week, so
  empty is a normal state, not an edge case.
- **User-visible text is Italian**, written the way the two users speak. "Fuori a
  cena", not "Pasto consumato fuori sede". Error messages say what happened and
  what to do next.

## Styling

Tailwind utilities in the markup. No CSS modules, no styled-components, no inline
`style` objects except for genuinely dynamic values.

Use the theme tokens — `bg-background`, `text-muted-foreground`, `border`. **No
hardcoded hex colours and no raw palette classes** like `bg-slate-800`: they break
the dark theme silently. Compose class names with `cn()` from `lib/utils`;
Prettier's Tailwind plugin sorts them, so do not reorder by hand.

### The type scale is Tailwind's, unmodified

`text-xs` is 12px, `text-sm` is 14px, `text-base` is 16px, `text-xl` is 20px.
Nothing overrides `--text-*` in `app/globals.css`, and there is no `font-size` on
`html`. Six of the thirteen steps are used: `xs`, `sm`, `base`, `lg`, `xl`, `3xl`.

Raised on 2026-08-19: the app reads small on a phone, because content sits at
`text-sm` and its details at `text-xs`, so the browser's own reading size is used
almost nowhere. Two theme-wide fixes were built and both were rejected — the
owner's call, and the reason is worth keeping: a scale whose names stop matching
their values costs more, later, than the forty class names it saves.

**The size is therefore decided per element, at the call site.** When a screen
reads too small, change its classes rather than the scale. Two things to know
before doing it:

- **`Button` has no size that raises its text.** `size` governs height and
  padding, so a `lg` button is taller with the same 14px label — upstream
  shadcn's design, so that buttons and inputs line up at a shared height. The
  only size that touches the font is `xs`, and it goes down. To make a button's
  text larger, pass `className="text-base"`: `cn()` is tailwind-merge, so the
  class from the call site beats the variant's. `components/app-nav.tsx:33`
  already does exactly this on the "Menu" trigger.
- The same holds for `Badge`, `Label`, `Card` and the `Field` parts: they carry
  `text-sm` or `text-xs` from the registry, and the call site overrides them.

## PWA

The app is installed to the home screen and receives shared links through the
Android share sheet (design document §6.1). Two consequences for the UI:

- The manifest is a real deliverable: icons, name, theme colour,
  `display: standalone`, and the `share_target` declaration.
- The import confirmation screen is the first thing a user sees after sharing a
  link, sometimes with a failed fetch behind it. It must work as a plain manual
  entry form, with no dead end.

`app/manifest.ts` is the manifest; `app/icons/[icon]/route.tsx` draws the icons
with `ImageResponse` at build time, so no binary lives in the repository. Icons
are the one place a colour is written as hex: a PNG cannot read a CSS variable,
so the two values there must be updated by hand when the theme changes.

`share_target` is **not** declared yet. It points at `/import`, which does not
exist; declaring it would put the app in the share sheet only to land on a 404.
It goes in with the import module.

## What is deliberately not in this file

| Topic                                                             | Where                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Accessibility, layout, interaction, UX review                     | `.agents/skills/web-design-guidelines/` — run it before calling UI work done |
| Component API design, compound components, avoiding boolean props | `.agents/skills/vercel-composition-patterns/`                                |
| Rendering and re-render performance, bundle size                  | `.agents/skills/vercel-react-best-practices/`                                |
| shadcn CLI, registry, styling, composition                        | `.agents/skills/shadcn/`                                                     |
