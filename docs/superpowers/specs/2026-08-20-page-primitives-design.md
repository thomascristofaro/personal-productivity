# Page primitives, round two — design

Date: 2026-08-20. Status: agreed in conversation, not yet built.

`components/page/` covers the list and the four designed states, and the
catalogue proved it transfers. It covers nothing of the form, nothing of the
drawer and nothing of the page shell — which is where most of the copied code
actually is. This document settles what is added, what is deliberately not
added, and which behaviours change on the way.

It does not restate craft. Component API reasoning comes from
`.agents/skills/vercel-composition-patterns/`; the project decisions it applies
are in `CLAUDE.md` and `docs/conventions/ui.md`.

## The problem, with evidence

| Duplication                                                                                              | Where                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errorOf` / `invalid` / `valueOf` / `describedBy`, plus `FIELD_ORDER` and the focus-first-invalid effect | `components/catalog/catalog-form.tsx:86-111` and `components/recipes/recipe-form.tsx:78-105`, identical                                                          |
| `valuesFrom` and `fieldErrorsFrom`                                                                       | `app/(app)/catalogo/actions.ts:33-56` and `app/(app)/recipes/actions.ts:47-98`; the comment at `actions.ts:45` says so out loud                                  |
| Six form-state shapes for two ideas                                                                      | `catalog-form.tsx:35`, `recipe-form-state.ts:1`, `slot-drawer.tsx:26`, `add-item-drawer.tsx:40`, `complete-purchase-bar.tsx:17`, `purchase-total-form.tsx:9`     |
| Close-on-success, in four implementations                                                                | `hooks/use-attempt.ts:17` (hook), `slot-drawer.tsx:83` (effect), `add-item-drawer.tsx:87`, `complete-purchase-bar.tsx:45`, `purchase-total-form.tsx:36` (inline) |
| The drawer shell: header, form, error, footer, pending label                                             | `slot-drawer.tsx:100-177`, `add-item-drawer.tsx:139-275`, `complete-purchase-bar.tsx:70-116`                                                                     |
| `<main className="flex flex-col gap-4 pt-6">` and its three variants                                     | 13 pages                                                                                                                                                         |
| The aisle-grouped `<section>` + `<h2>` + `<ul>`                                                          | `shopping-list.tsx:81`, `spesa/storico/[id]/page.tsx:67`, `dismissed-list.tsx:26`                                                                                |
| `<p role="alert" className="text-sm text-destructive">`                                                  | 6 files                                                                                                                                                          |
| `{isPending ? "Salvo…" : "Salva"}`                                                                       | 5 files                                                                                                                                                          |
| Byte-identical `error.tsx`                                                                               | 5 files                                                                                                                                                          |

Two of these are not merely repetition:

- **`spesa/storico/[id]/page.tsx:62` set its own trigger** — _"Two screens
  sharing them is not yet a component; if a third wants them, extract then."_
  `DismissedList` is the third.
- **Hand-wiring already failed once.** `Field` in `components/ui/field.tsx` is a
  plain `<div role="group">` with no automatic association, and
  `add-item-drawer.tsx:248` has a `FieldDescription id="kind-description"` that
  no control references. For a screen reader that description does not exist.

## What this is not

- Not a page generator. There is no `<CrudPage entity={…} />` and there will not
  be one: a configuration object becomes a language only its author can read, and
  every custom screen then fights it. The target is that a page stays a file and
  drops from ~90 lines to ~25.
- Not a rewrite of `components/ui/`. Those files stay byte-identical to the
  registry so a preset can still be applied.
- Not a new component library. Everything below is composed from what is already
  installed.

## Decisions

### One state shape

```ts
// lib/form.ts — no imports at all, because client components read it
export type FormState = {
  ok: boolean
  message: string | null
  errors: Record<string, string[]>
  values: Record<string, string>
}

export type FormAction = (
  state: FormState,
  formData: FormData
) => Promise<FormState>

export const EMPTY_FORM_STATE: FormState = {
  ok: false,
  message: null,
  errors: {},
  values: {},
}

export function failure(message: string, parts?: Partial<FormState>): FormState
export function success(message?: string | null): FormState
```

One shape, not two. `errors` and `values` are **required and never
`undefined`**, which is what removes `state.values?.[field] ?? …` from every call
site. Nobody writes them by hand — `failure()` and `success()` do.

The cost is accepted knowingly: a drawer carries an `errors` map no field of its
own reads. Two shapes would remove that, and would add the question "which one do
I use" to every new form — which is the friction this work exists to remove.

Actions that `redirect` on success never return, so `ok` is only ever read by the
screens that stay open. That is not a reason to make it optional.

### Two files, because of one import

`lib/form.ts` imports nothing. `lib/form-errors.ts` holds
`fieldErrorsFrom(ZodError)` and `valuesFrom(FormData, fields)`, which only server
actions call. The split is by consumer — client-facing against server-facing.
The bundle risk is latent rather than present: `fieldErrorsFrom` needs only
`import type { ZodError }`, which is erased at build, so nothing reaches the
browser today. The split is what keeps it that way the day somebody adds a
runtime Zod value to these helpers. Both are leaf modules under
`architecture.md`: constants and pure computation, no database, no network, no
framework.

### The hook carries the ARIA

```ts
const { state, formAction, isPending, attempt, fieldProps, errorOf } =
  useFormState(action, FIELD_ORDER, values)

fieldProps("name")
// → { id, name, defaultValue, "aria-invalid"?, "aria-describedby"? }
```

`useFormState` does the three things every form copies today: `useActionState`,
the attempt counter that remounts the fields (see `hooks/use-attempt.ts`, which
stays and becomes its internal detail), and the focus on the first invalid field.
`initialValues` is the fallback when the state carries nothing, exactly as
`valueOf` does today.

**The `hasDescription` boolean disappears from the typed fields.** `TextField`
receives `description` as its own prop, so it knows whether to add
`${name}-description` to the `aria-describedby` that arrived in the spread. The
boolean survives only in the escape hatch, where the call site writes the
control: `fieldProps("defaultUnit", { described: true })`. Five call sites out of
eighteen, all explicit.

### Typed fields, plus one escape hatch

`TextField`, `NumberField`, `TextareaField`, `SelectField` cover the common case.
`FormField` takes the control as `children` and covers the rest.

**Typed fields define `label`, `description` and `error` and nothing else.**
`name`, `id` and `defaultValue` are not their props — those arrive inside the
spread from `fieldProps`. The error is a prop and not part of the spread because
`fieldProps` returns DOM attributes, and the error's _text_ would land on the
element as an unknown attribute. Everything else spreads onto the native
control, so `min`, `step`, `rows`, `type`, `inputMode`, `placeholder` and
`required` pass through because they are DOM attributes, not props anybody
designed. Our own surface stays at three props forever. Without this rule
`NumberField` grows a `min` in week one and an `allowDecimals` in week two.

**`SelectField` has one more, and it is the only exception.** A select with no
options is nothing, and no DOM attribute carries them:

```ts
options: readonly string[]        // value equals label — the aisles
options: Record<string, string>   // value differs from label — INGREDIENT → "Ingrediente"
```

One prop for both cases, and the map is exactly the `items` Base UI requires.
The trap recorded in the roadmap — the Tipo field reading `INGREDIENT` on screen
— becomes unrepeatable, because it now goes through the same prop.

Measured against the eighteen fields that exist today, thirteen are covered by
the typed components and five reach for `FormField`: `defaultUnit` with its
`datalist`, the two `IngredientPicker`s, the `RecipePicker`, and the
`skipCatalog` checkbox.

**Reaching for `FormField` is normal, not a failure.** Written down because the
typed four otherwise read as the official ones, the hatch reads as a defeat, and
somebody bends `TextField` instead of dropping a level — which is the disease
being treated.

### Two small components, and who holds the remount key

`FormMessage` renders the form-level `<p role="alert">` and nothing when the
message is null, replacing six copies. `FormActions` renders the submit button
with its pending label and an optional cancel link — `cancelHref`, `isPending`,
and `submitLabel`/`pendingLabel` defaulting to "Salva"/"Salvo…". It is optional:
`PurchaseTotalForm` has a single outline button and no cancel, so it writes its
own.

**The `key={attempt}` sits on the `FieldGroup`, and the call site puts it
there** — except inside `FormDrawer`, which owns its own `FieldGroup` and so
owns the key too. It is not applied inside the field components: keying each
field separately would remount them one by one and lose the single-commit
behaviour the counter exists for.

### State reaches fields by explicit spread

`<TextField {...fieldProps("title")} label="Nome" />`. No context, no compound
component, no provider. One rule for the whole layer: where a value comes from is
visible at the call site, and a controlled field overwrites `value` and
`onChange` after the spread — which is what `add-item-drawer`'s unit and aisle
need. `defaultValue` would still be in that spread, and React warns about a
native input carrying both — so a controlled call site asks for
`fieldProps(field, { controlled: true })`, which drops `defaultValue` instead of
leaving it to be overwritten.

### The drawer is always controlled, and does not own the hook

```tsx
const form = useFormState(addItem, FIELD_ORDER, values)
const [open, setOpen] = useState(false)

<FormDrawer open={open} onOpenChange={setOpen} form={form}
  title="Aggiungi alla lista"
  description="Qualsiasi cosa: un ingrediente, lo shampoo, i sacchetti."
  submitLabel="Aggiungi" pendingLabel="Aggiungo…">
  <NumberField {...form.fieldProps("quantity")} label="Quantità" min={0.01} step="any" />
</FormDrawer>
```

It renders the header, the `<form>`, the `FieldGroup` keyed on the attempt, the
message and the footer. Children are the fields and nothing else.

**Close-on-success becomes one implementation**, in a `useEffect` inside
`FormDrawer` keyed on `form.attempt`: when the attempt changes and `state.ok`
is true, it calls `onOpenChange(false)`. Not during render — `FormDrawer` is
always controlled, so `onOpenChange` is by definition the _parent's_ setter,
and calling another component's setter during your own render is exactly what
React forbids, producing "Cannot update a component while rendering a
different component" on every successful save. Adjusting your own state during
render, which is what `add-item-drawer.tsx:87` and
`complete-purchase-bar.tsx:45` did, is legal; adjusting a parent's is not. The
distinction that matters is own state versus another component's state, not
render versus effect as a style preference. The effect at `slot-drawer.tsx:83`
and the two inline copies go.

**The trigger stays outside**, where its positioning lives: the floating round
button keeps its safe-area maths in `AddItemDrawer`, the fixed bar keeps its own
in `CompletePurchaseBar`, and `WeekGrid` keeps driving the slot from above.

`FormDrawer` takes **no `after` prop**. The only case that wanted one was the
slot drawer's second `<form>` for «Svuota», and that button is being removed —
see below.

### Shells know nothing about the header

`ListBody` (`gap-4`) and `DetailBody` (`gap-6`) render the `<main>` and its
spacing. `PageHeader` stays the separate component it already is, because the
recipe detail puts a metadata paragraph and a three-button toolbar between the
header and the content (`recipes/[id]/page.tsx:59`, because at 390px three
buttons do not fit beside a title) — an absorbed header would have to grow slots
to hold them.

The `pb-24` that `spesa/[weekStart]` carries today belongs to the fixed bar, not
to the page.

### The section, not the list of sections

`ListSection`, not `GroupedList`:

```tsx
<ListSection title="ortofrutta">{rows}</ListSection>
<ListSection title="Tolte dalla lista" className="border-t pt-4">{rows}</ListSection>
```

Two of the three call sites map over groups; `DismissedList` is a single section
with a fixed title. A component taking a list of groups would force the third to
pass an array of one. Callers that have groups map over them; callers that have
one use it once. No render prop, no invented array.

### «Svuota» goes, and the asymmetry it was hiding goes with it

A **note** can already be cleared by hand: empty the field, save, and
`optionalText` reads it as `null`. A **recipe** cannot:
`recipe-picker.tsx:39` discards the `null`, and the combobox's own clear button
exists at `components/ui/combobox.tsx:39` behind a `showClear` that defaults to
false and nobody passes. So «Svuota» is not a redundant button — it is the only
way out of a slot holding a recipe, and one of the two owners never noticed it.

The fix is to make clearing possible where a person looks for it:

1. `RecipePicker` shows the clear button and accepts the `null`.
2. `setSlot` deletes the row when the input is empty, instead of writing a row
   that means nothing. `SlotInputSchema` already accepts both fields null — it
   only forbids both being set — so no schema change is needed. The TSDoc at
   `lib/services/menus.ts:161` already states the rule: an empty slot and an
   absent slot must mean the same thing.
3. The `emptySlot` action, the second `<form>` and the trap comment at
   `slot-drawer.tsx:179-198` are deleted.

Cost: one more tap (open → clear → save, against open → «Svuota»), in the place
somebody would look. If the browser check at 390px says the clear button does not
work on a phone, «Svuota» comes back and `FormDrawer` gains `after`.

### Message pages keep their heading

`EmptyState` renders a `<p>`, which is right inside a page whose `<h1>` comes
from `PageHeader`. The three "does not exist" pages have no `PageHeader` and use
`<h1>`; folding them into `EmptyState` would leave three pages with no heading.
They get `MessagePage({ title, children })` instead.

`PageError` is not one of them and stays as it is: a `role="alert"` should be
announced, not be a heading. It gains an optional `error` prop only so the five
identical `error.tsx` files can become a re-export.

### Withdrawn: `countLabel`

Proposed in the analysis, and it does not hold. The three `announce()` functions
are three lines of Italian copy that differ completely each time — gender, noun,
agreement. A helper would turn them into an object of strings the same length,
with one more indirection and a test that would restate the implementation.
They stay local to their page.

`firstOf` stays, and has no test for the same reason. It earns its place not for
the line it saves but because the comment about Next resolving a repeated param
to an array — written twice today, at `recipes/page.tsx:22` and
`catalogo/page.tsx:22` — ends up in one place.

## Where things live

```
lib/
  form.ts            FormState, EMPTY_FORM_STATE, FormAction, failure, success
  form-errors.ts     fieldErrorsFrom, valuesFrom
  search-params.ts   firstOf
hooks/
  use-form-state.ts  useFormState
  use-attempt.ts     unchanged; becomes an internal detail of the above
components/page/
  page-body.tsx      ListBody, DetailBody
  fields.tsx         TextField, NumberField, TextareaField, SelectField
  described-by.ts    mergeDescribedBy, joining a field's own aria-describedby
                      with its description's id
  form-field.tsx     FormField
  form-drawer.tsx    FormDrawer
  form-message.tsx   FormMessage
  form-actions.tsx   FormActions
  search-field.tsx   SearchField
  filter-chips.tsx   FilterChips
  list-section.tsx   ListSection
  message-page.tsx   MessagePage
```

`SearchField` and `FilterChips` are `RecipeSearch` and `KindFilter` with the
route as a prop instead of written inside. `FilterChips` keeps its `keep` prop —
today `KindFilter`'s `query` — because a chip must not throw away what was typed.

## Behaviour changes

Approved in conversation on 2026-08-20. Nothing else may change.

| Change                                                                                                | Visible where       |
| ----------------------------------------------------------------------------------------------------- | ------------------- |
| «Svuota» removed; the recipe clears with the combobox's clear button; saving an empty slot deletes it | slot drawer         |
| `/catalogo` gains the search field. `?q=` already works server-side; only the input was missing       | catalogue list      |
| The «Tipo» description becomes reachable by screen readers (`add-item-drawer.tsx:248`)                | screen readers only |
| The three "does not exist" pages become one `MessagePage` at the same appearance                      | 404                 |

**What must not change**, and what the checklists verify: the spacing of all 13
pages; the text and behaviour of every error message; the echo of submitted
values after a refused save; the focus on the first invalid field; the two
controlled fields in `add-item-drawer` (unit and aisle), which must not fight
`defaultValue`; and the fallback to `altro` when Base UI reports a cleared aisle.

## Tasks

One branch, three tasks, three checklists. `pnpm verify` green at every task
boundary, so the branch is mergeable at each of them.

**Task 1 — the shells and the form contract.** `page-body.tsx` applied to the 13
pages first, because it is mechanical and gets the churn out of the way. Then
`lib/form.ts`, `lib/form-errors.ts`, `use-form-state`, the four typed fields,
`FormField`, `FormMessage`, `FormActions`. `CatalogForm`, `RecipeForm` and
`PurchaseTotalForm` rewritten, and the three `actions.ts` with them. Unit tests
for `fieldErrorsFrom` and `valuesFrom`.

_Checklist:_ every page opens with unchanged spacing; on the three forms — a
valid save, a refusal that echoes the values, focus landing on the first invalid
field, and Annulla.

**Task 2 — the drawer.** `FormDrawer`, the three drawers rewritten, the clear
button on `RecipePicker`, `setSlot` deleting on empty input, `emptySlot` removed.

_Checklist:_ each drawer opens, saves and closes itself; a slot holding a recipe
empties with clear + save and leaves no row behind; the floating button and the
fixed bar stay above the safe area.

**Task 3 — the lists.** `SearchField`, `FilterChips`, `ListSection`, `firstOf`,
`MessagePage`, the five `error.tsx` reduced to a re-export, and the catalogue's
search field.

_Checklist:_ search on the recipe book and the catalogue; chips that keep the
query; the aisle sections on all three screens; the four designed states of every
list; 404 and the error boundary.

All three at 390px through the `playwright` MCP server, as
`docs/roadmap.md` records: an agent running a written checklist, not an
end-to-end test suite.

## Consequences for the documents

`docs/conventions/ui.md` gains the new primitives in its "Page primitives" table,
the rule that typed fields define only `label` and `description`, and the note
that reaching for `FormField` is normal. `docs/roadmap.md` gains the row. Without
that, the next module will not know these exist and will write them again —
which is exactly today's problem.
