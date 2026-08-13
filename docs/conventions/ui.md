# UI conventions

Only what is specific to this project. General craft — accessibility, layout,
interaction, performance — is not repeated here: it comes from the skills listed
at the bottom, which are more complete and stay maintained.

## shadcn/ui is the only component library

Binding (design document §4.3).

- The project is already initialised: `components.json`, style `base-mira`, base
  colour `mist`, `rsc: true`. **Do not re-run `init`** and do not change the theme
  configuration.
- Add components one at a time: `pnpm dlx shadcn@latest add <component>`. They land
  in `components/ui/` and become project source.
- Need a behaviour change? Edit the file in `components/ui/` directly. Do not wrap
  it in an adapter to avoid touching it — that leaves two places to look and one
  of them lies.
- Component missing from shadcn? Compose it from existing primitives inside
  `components/`. Do not install another library, do not hand-write a base
  component.

Expected set for the first module: `button`, `input`, `textarea`, `card`,
`dialog`, `drawer`, `sheet`, `checkbox`, `select`, `command`, `form`, `label`,
`tabs`, `badge`, `separator`, `skeleton`, `sonner`, `alert-dialog`.

**This installation is built on Base UI, not Radix.** Almost every shadcn example
online is written against Radix, so prop names and composition patterns do not
always transfer. Read `.agents/skills/shadcn/rules/base-vs-radix.md` rather
than adapting a blog post by guesswork.

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
- **Touch targets at least 44px**, including shopping-list checkboxes, which are
  tapped one-handed while holding a basket (design document §4.3).
- **Every screen that fetches has three designed states**: loading, empty, error.
  The menu and the shopping list start empty every week, so empty is a normal
  state, not an edge case.
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

## PWA

The app is installed to the home screen and receives shared links through the
Android share sheet (design document §6.1). Two consequences for the UI:

- The manifest is a real deliverable: icons, name, theme colour,
  `display: standalone`, and the `share_target` declaration.
- The import confirmation screen is the first thing a user sees after sharing a
  link, sometimes with a failed fetch behind it. It must work as a plain manual
  entry form, with no dead end.

## What is deliberately not in this file

| Topic                                                             | Where                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Accessibility, layout, interaction, UX review                     | `.agents/skills/web-design-guidelines/` — run it before calling UI work done |
| Component API design, compound components, avoiding boolean props | `.agents/skills/vercel-composition-patterns/`                                |
| Rendering and re-render performance, bundle size                  | `.agents/skills/vercel-react-best-practices/`                                |
| shadcn CLI, registry, styling, composition                        | `.agents/skills/shadcn/`                                                     |
