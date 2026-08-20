# UI conventions

Two things: the decisions that are ours, and the recipes for building a screen
out of them. General craft — accessibility, layout, performance — is not here.
It comes from the skills listed at the bottom.

## shadcn/ui is the only component library

Binding (design document §4.3).

- Already initialised — `components.json` holds the style, the base colour and
  `rsc: true`. Read it rather than trusting this line, and **do not re-run
  `init`**.
- The theme changes only by applying a preset chosen on `ui.shadcn.com/create`.
  Never edit the CSS variables by hand: they are the preset's output and a hand
  edit is lost at the next one.
- Applying a preset **rewrites every file in `components/ui/`**. That is safe only
  while they stay stock, which is what the next rule protects.
- Add one at a time: `pnpm dlx shadcn@latest add <component>`. They land in
  `components/ui/` and become project source.
- Need a behaviour change? Edit the file in `components/ui/` in place. Do not
  wrap it in an adapter — that leaves two places to look and one of them lies.
- Missing from shadcn? Compose it from existing primitives inside `components/`.
  Do not install another library, do not hand-write a base component.
- Screen-reader text that ships in English is not edited. Override it from the
  call site — `aria-label="Apri il menu"` — so the file stays byte-identical.

**This installation is Base UI, not Radix.** Most shadcn examples online are
written against Radix and do not transfer verbatim. Read
`.agents/skills/shadcn/rules/base-vs-radix.md` rather than adapting a blog post
by guesswork.

Forms are built from `field` — `FieldGroup`, `Field`, `FieldLabel`,
`FieldDescription`, `FieldError` — never from a `div` with `space-y-*`.

## The primitives

A screen is assembled from these, not rebuilt. In `components/page/` unless
stated.

| Primitive                                                     | Signature, in short                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ListBody` / `DetailBody`                                     | the `<main>` and its spacing — `gap-4` for a list, `gap-6` for a form or detail |
| `PageHeader`                                                  | `title`, optional `back={{ href, label }}`, children as the action slot         |
| `DataList`                                                    | `items`, `announcement`, `renderItem`, `empty` — includes the count live region |
| `DataListRow`                                                 | `href`, `title`, children as the muted detail line                              |
| `EmptyState`                                                  | `title`, optional `description`, children as the action                         |
| `ListSection`                                                 | `title` + children — **one** section, not a list of them                        |
| `SearchField`                                                 | `basePath`, `placeholder`, `label`, `param="q"` — debounced, replaces the URL   |
| `FilterChips`                                                 | `basePath`, `param`, `chips`, `active`, `label`, `keep` — links, not buttons    |
| `MessagePage`                                                 | `title` + children, for a page with no `PageHeader`                             |
| `PageError`                                                   | the body of a route's `error.tsx`                                               |
| `ListSkeleton` / `DetailSkeleton`                             | `label`, and `rows` for the list — the body of `loading.tsx`                    |
| `TextField` / `NumberField` / `TextareaField` / `SelectField` | the four typed fields                                                           |
| `FormField`                                                   | `name`, `label`, `description`, `error` + the control as children               |
| `FormMessage`                                                 | the form-level `<p role="alert">`; renders nothing for `null`                   |
| `FormActions`                                                 | `cancelHref`, `isPending` — submit with its pending label, plus Annulla         |
| `FormDrawer`                                                  | `open`, `onOpenChange`, `form`, `title`, `submitLabel`, `pendingLabel`          |
| `useFormState` (`hooks/`)                                     | everything a form needs from its action — see the contract below                |
| `firstOf` (`lib/search-params`)                               | a `searchParams` value Next may have resolved to an array                       |
| `decodeSegment` (`lib/route-params`)                          | a dynamic segment, still percent-encoded as Next hands it over                  |

**If a new module needs one bent, bend the primitive rather than fork it.** A
second copy of `DataListRow` with one prop changed is how this directory stops
being worth having.

## Building a page

### A list

`app/(app)/catalogo/page.tsx` is the full version — search, chips, three empty
states. `/recipes` drops the chips, `/spesa/storico` drops both.

```tsx
export default async function CatalogPage({
  searchParams,
}: {
  // Next resolves a repeated param to an array, not a string.
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const q = firstOf((await searchParams).q)
  const isSearching = Boolean(q?.trim())
  const items = await listCatalogItems(q)

  return (
    <ListBody>
      <PageHeader title="Catalogo">
        <Button render={<Link href="/catalogo/new" />} nativeButton={false}>
          Nuova
        </Button>
      </PageHeader>

      {/* SearchField reads useSearchParams, so it needs a boundary. */}
      <Suspense>
        <SearchField
          basePath="/catalogo"
          placeholder="Cerca…"
          label="Cerca una voce"
        />
      </Suspense>

      <DataList
        items={items}
        announcement={announce(items.length)}
        renderItem={(item) => (
          <DataListRow
            key={item.name}
            href={`/catalogo/${encodeURIComponent(item.name)}/edit`}
            title={item.name}
          >
            <Badge variant="secondary">{item.aisle}</Badge>
          </DataListRow>
        )}
        empty={
          isSearching ? (
            <EmptyState title="Nessuna voce con questo nome." />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto."
              description="Aggiungi la prima voce."
            >
              <Button
                render={<Link href="/catalogo/new" />}
                nativeButton={false}
              >
                Nuova voce
              </Button>
            </EmptyState>
          )
        }
      />
    </ListBody>
  )
}
```

`announce` is a local function returning the count sentence — zero, one, many.
It is written per page because Italian agrees the participle with the noun's
gender: «voci trovat**e**», «articoli trovat**i**».

A row whose detail line is more than a couple of nodes may live in its own
component, but it still renders `DataListRow`. Do not build a second row.

### A create/edit form

Two pages sharing one form component. `catalogo/new` and `catalogo/[name]/edit`
are the pair; the edit page adds `decodeSegment` and the delete button.

```tsx
export default async function NewCatalogItemPage() {
  const units = await listUsedUnits()

  return (
    <DetailBody>
      <PageHeader title="Nuova voce" back={{ href: "/catalogo", label: "Catalogo" }} />
      <CatalogForm action={saveCatalogItem} units={units} values={{ name: "", … }} />
    </DetailBody>
  )
}
```

The page fetches and passes props; the form component is the client boundary and
owns nothing else. Fetch in parallel with `Promise.all` — a sequential await is
the waterfall the React skill ranks CRITICAL.

An edit page reached through a dynamic segment **must** decode it:

```tsx
const name = decodeSegment((await params).name)
if (name === null) notFound() // a malformed escape means 404, not 500
```

### A quick drawer

For a form that must not leave the page — a menu slot, a shopping line, the
amount at the till.

```tsx
const form = useFormState(action, FIELD_ORDER, { kind: "PRODUCT" })

<FormDrawer
  open={open} onOpenChange={setOpen} form={form}
  title="Aggiungi alla lista" submitLabel="Aggiungi" pendingLabel="Aggiungo…"
>
  <input type="hidden" name="weekStart" value={week} />
  <NumberField {...form.fieldProps("quantity")} label="Quantità" error={form.errorOf("quantity")} min={0.01} />
</FormDrawer>
```

**Always controlled**: `open` and `onOpenChange` come from the call site, and
`FormDrawer` does not own the hook. The three triggers in this app — a floating
button, a fixed bar, a parent holding the open slot — stay three things, which
is what they are. It closes itself on success, from an effect keyed on
`form.attempt`; closing during render would update the parent mid-render.

State the drawer cannot see — a picker's chosen name — is reset by the call site,
adjusting its own state when `form.attempt` moves. Legal for own state, never for
a parent's.

### Every route needs four files

`page.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx` where a thing can be
missing. The last two are near-copies on purpose:

```tsx
// error.tsx — Next requires a client component per segment.
"use client"
export { PageError as default } from "@/components/page/page-error"

// loading.tsx
export default function Loading() {
  return <ListSkeleton label="Caricamento del catalogo…" rows={6} />
}
```

`pnpm verify` cannot prove an `error.tsx` re-export works — `tsc` and `eslint`
do not resolve route conventions. `next build` does.

## The form contract

One shape, from `lib/form.ts`, for every server action a form calls.

**The action** validates, authenticates, authorises, mutates — in that order,
inside itself, because a server action is a public endpoint.

```ts
export const saveCatalogItem: FormAction = async (_state, formData) => {
  // Every refusal echoes the same fields; `failure` cannot reach formData.
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

  const parsed = Schema.safeParse({ name: formData.get("name"), … })
  if (!parsed.success) return refuse("Controlla i campi segnalati.", fieldErrorsFrom(parsed.error))

  await requireSession()
  // …mutate…
  return success()          // or redirect(…, RedirectType.replace)
}
```

**Always echo the values on a refusal.** React 19 resets an uncontrolled form to
its `defaultValue`s before the action runs, so anything not echoed is lost —
including an amount typed at a till from a receipt already back in a pocket.

**The client** calls `useFormState(action, FIELD_ORDER, initialValues)` and gets
`{ state, formAction, isPending, attempt, errorOf, fieldProps }`. `FIELD_ORDER`
is a module-level constant in DOM order, so the first invalid field takes focus;
a fresh array each render would re-run that effect.

```tsx
<TextField
  {...fieldProps("name")}
  label="Nome"
  error={errorOf("name")}
  required
/>
```

`fieldProps` emits DOM attributes only — `id`, `name`, `defaultValue`,
`aria-invalid`, `aria-describedby`. **Never the error text**, which would land on
the element as an unknown attribute; field components take it as a prop.

Three rules that are easy to get wrong:

- **The remount key.** An uncontrolled input whose `defaultValue` changed after
  mount needs `key={\`name-${attempt}\`}`to pick it up. Key the`FieldGroup`
  when it holds only flat fields; key **each field** when the group also holds
  components with their own state — remounting those threw away eight typed
  ingredients on a refused save. Sibling keys must differ, hence the field name.
- **A controlled field asks `fieldProps` to drop `defaultValue`.** Adding `value`
  and `onChange` after the spread is not enough: React warns when a native input
  receives both. Call `fieldProps(field, { controlled: true })`.
- **`FormField` points its own control at the description.** The typed four do it
  themselves; when you write the control, pass `fieldProps(field, { described: true })`.

**A typed field defines `label`, `description` and `error`, and nothing else.**
`id`, `name` and `defaultValue` arrive in the spread. Everything past the three
stays a DOM attribute and lands on the native control, so `min`, `step`, `rows`,
`type`, `inputMode` and `placeholder` pass through as what they already are.
`SelectField` carries one more and it is the only exception: `options`, a list
when value equals label and a map when it does not — which is what stops Base
UI's `Select.Value` rendering `INGREDIENT` instead of «Ingrediente».

**Reaching for `FormField` is normal, not a failure.** Written down on purpose:
otherwise the typed four read as the official ones, the hatch reads as a defeat,
and the next person bends `TextField` to fit. A bare control with its own
`aria-label` is fine too, where the control names itself.

## The four states

**Every screen that fetches has four**, not three. The design document names
three; use showed the fourth.

1. **Empty** — nothing exists yet. Say so and offer the action that creates one.
2. **Filtered empty** — data exists, the filter matched nothing. Different copy,
   and **no create button**: the user is looking, not authoring.
3. **Error** — `PageError`. Never a partial page over a failed fetch.
4. **Loading** — `ListSkeleton` or `DetailSkeleton` in `loading.tsx`.

States 1 and 2 are **two call sites passing different strings to `EmptyState`**,
not one component with a boolean. Adding an `isSearching`-style prop to a
primitive is the thing `components/page/` exists to prevent.

`MessagePage` is not `EmptyState` with other copy: `EmptyState` renders a `<p>`,
correct under a `PageHeader`'s `<h1>`. The "does not exist" screens have no
`PageHeader`, so folding them in would leave three pages with no heading.

## Server and client

Server component by default. `"use client"` only for state, effects, event
handlers or browser APIs, and as far down the tree as possible.

A client component never imports from `lib/services/`. Data arrives as props from
a server component, or through a server action. ESLint enforces it.

This constrains composition: prefer passing `children` from a server component
over a Context provider, because a provider is itself a client component and
pulls the boundary upward. Use Context only for genuinely shared interactive
state.

## The app shell

`app/(app)/layout.tsx` mounts `components/app-nav.tsx` — a sticky bar with the
hamburger, the word "Menu" and the theme toggle, and behind it a `sheet`. The
layout stays a server component: `AppNav` sits beside `children`, not around it.

**One navigation at every width.** The desktop rail was removed on 2026-08-16;
the owner's use is phone and tablet, and two behaviours bought nothing.

Adding a module is one entry in `NAV_ITEMS`. Only routes that exist are listed —
a nav entry that 404s is worse than a short menu. The theme is switched from the
bar and nowhere else.

## Styling

Tailwind utilities in the markup. No CSS modules, no styled-components, no inline
`style` except for genuinely dynamic values.

Use the theme tokens — `bg-background`, `text-muted-foreground`, `border`. **No
hex colours and no raw palette classes** like `bg-slate-800`: they break the dark
theme silently. Compose with `cn()` from `lib/utils`; Prettier's Tailwind plugin
sorts the classes, so do not reorder by hand.

**The type scale is Tailwind's, unmodified.** Nothing overrides `--text-*`, and
there is no `font-size` on `html`. The app reads small on a phone; two
theme-wide fixes were built and both rejected on 2026-08-19 — the owner's call,
and the reason is worth keeping: a scale whose names stop matching their values
costs more, later, than the class names it saves.

**Size is therefore decided per element, at the call site.** One trap:
`Button` has **no size that raises its text** — `size` governs height and padding
so buttons line up with inputs. Pass `className="text-base"`; `cn()` is
tailwind-merge, so the call site beats the variant. Same for `Badge`, `Label`,
`Card` and the `Field` parts.

## Product decisions

- **Phone first, desktop tolerable.** Design at 390px and let it grow. Prefer
  `drawer` over `dialog`: thumbs reach the bottom of the screen.
- **Touch targets: the shadcn scale, unmodified.** The design document asked for
  44px (§4.3); the style generates 28px and we take it as it comes, because
  staying stock keeps every component upgradeable. A deliberate trade-off, made
  before real use. Revisit it the first time someone mis-taps on a phone — the
  fix is then to edit the size variants in `components/ui/` in place, which is
  what owning the source is for.
- **User-visible text is Italian**, written the way the two users speak. «Fuori a
  cena», not «Pasto consumato fuori sede». Error messages say what happened and
  what to do next.
- Empty is a normal state here, not an edge case: the menu and the shopping list
  start empty every week.

## PWA

The app is installed to the home screen and receives shared links through the
Android share sheet (design document §6.1).

`app/manifest.ts` is the manifest; `app/icons/[icon]/route.tsx` draws the icons
with `ImageResponse` at build time, so no binary lives in the repository. Icons
are the one place a colour is written as hex — a PNG cannot read a CSS variable,
so those two values are updated by hand when the theme changes.

`share_target` is **not** declared yet: it points at `/import`, which does not
exist. It goes in with the import module. Whatever that screen becomes, it must
work as a plain manual entry form — every LLM-assisted path has a working manual
equivalent, and this one is the first thing a user sees after sharing a link.

## What is deliberately not in this file

| Topic                                                             | Where                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Accessibility, layout, interaction, UX review                     | `.agents/skills/web-design-guidelines/` — run it before calling UI work done |
| Component API design, compound components, avoiding boolean props | `.agents/skills/vercel-composition-patterns/`                                |
| Rendering performance, bundle size                                | `.agents/skills/vercel-react-best-practices/`                                |
| shadcn CLI, registry, styling, composition                        | `.agents/skills/shadcn/`                                                     |
| What shipped and what is next                                     | [`../roadmap.md`](../roadmap.md)                                             |
