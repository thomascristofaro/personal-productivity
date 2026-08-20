# Page primitives — the polish the closeout deferred

Branch: `feat/page-primitives` (PR #16), on top of `9e1cf7d`.

The primitives landed and every screen moved onto them. What follows are the
items the whole-branch review raised and the closeout did not take, plus the one
folding the review itself asked for. None changes a decision; all of them are
inside the layer that was just built, which is why they belong here rather than
in a later branch that would have to re-learn the context.

Ordered so each task lands on a tree the previous one left green.

---

## Task 1 — `FormField` becomes the only shell

`components/page/form-field.tsx` and the three typed fields in
`components/page/fields.tsx` render the same six lines: `<Field data-invalid>`,
`<FieldLabel htmlFor>`, the control, a conditional `<FieldDescription>` with a
derived id, and `<FieldError>` with a derived id. The shell exists four times in
two files that sit next to each other. `fields.tsx` exists to end copies and
contains three.

**Do:** `TextField`, `TextareaField` and `SelectField` each render `FormField`
with their own control as `children`. `mergeDescribedBy` stays where it is —
only the control knows its own `aria-describedby`.

**Do not:** change `FormField`'s public props. Two call sites use it directly and
neither should have to move.

**Verify:** `pnpm verify`, then the rendered markup of `/catalogo/nuovo` is
unchanged — same ids, same `aria-describedby`, same `data-invalid`.

## Task 2 — `id` is required, so `String(control.id)` cannot lie

`String(control.id)` produces the string `"undefined"` when a call site omits
`id`. Every call site spreads `fieldProps`, which always supplies one, so today
it is unreachable — but it is unreachable by convention, not by the type.

**Do:** intersect `{ id: string }` into the props of `TextField`,
`NumberField` and `TextareaField`. `SelectField` already requires it. Drop the
casts.

**Verify:** `pnpm verify`. A missing `id` becomes a compile error.

## Task 3 — one `refuse()` per actions file

`recipes/actions.ts` and `catalogo/actions.ts` write
`valuesFrom(formData, FORM_FIELDS)` five times each. The shared `failure()`
cannot capture `formData` the way the old local closure did, so the repetition
is a consequence of the refactor, not something it inherited.

**Do:** a private `refuse(message, errors?)` inside each action, closing over
`formData`.

**Do not:** put it in `lib/form.ts`. It would have to take `formData`, and then
it saves nothing.

**Verify:** `pnpm verify`. Every refusal still carries the same values.

## Task 4 — `complete` echoes the total

`app/(app)/spesa/[weekStart]/actions.ts`: of the six actions returning a
`FormState`, `complete` is the only one that refuses without echoing. Concretely:
mistype the amount at the till, and instead of finding it there to correct you
find the field empty — `FormDrawer` keys its `FieldGroup` on `attempt`, so the
input remounts to a `defaultValue` nothing filled.

**Do:** `values: valuesFrom(formData, ["total"])` on every refusal in `complete`.

**Verify:** in the browser, at `/spesa/<settimana>`, tick a line, open the bar,
type `abc`, confirm. The error shows and `abc` is still in the field.

## Task 5 — the dead `"id"` echo

`recipes/actions.ts`'s `FORM_FIELDS` includes `"id"`. `RecipeForm` renders the
hidden id from its props, never from `state.values`. The echo is written and
never read.

**Do:** remove `"id"` from `FORM_FIELDS`.

**Do not:** touch `"notes"`, which is read — the form renders
`state.values.notes ?? values.notes`, and without it a refused save would blank
a column the UI cannot edit.

**Verify:** `pnpm verify`, and a refused recipe save still keeps the notes.

## Task 6 — the inert `defaultValue="PRODUCT"`

`add-item-drawer.tsx` writes `defaultValue="PRODUCT"` **after**
`{...form.fieldProps("kind")}`, so it overrides the echoed value. Today nothing
breaks, because a refused add never reaches a state where the two differ — but
it is wiring that only appears to work.

**Do not** simply move it before the spread: `fieldProps` falls back to `""`
when there is no state and no initial value, which would override `PRODUCT` on a
first render. Seed it instead:
`useFormState(action, FIELD_ORDER, { kind: "PRODUCT" })`, and delete the prop.

**Verify:** open the drawer on a name the catalogue does not hold — «Tipo» reads
«Prodotto».

## Task 7 — the till form keys a group, like everything else

`purchase-total-form.tsx` puts the remount key on a bare `<div>`; the four other
call sites key a `<FieldGroup>`. One child, so the group's gap never applies —
this is about the layer speaking one dialect.

**Do:** `<FieldGroup key={attempt}>`.

**Verify:** `/spesa/storico/<id>` looks the same.

## Task 8 — one import from `@/lib/form`

`spesa/storico/actions.ts` imports from it twice, once for values and once for
the type.

**Do:** merge into `import { failure, success, type FormAction }`.

## Task 9 — the sixth `role="alert"` paragraph

`components/auth/google-sign-in.tsx` hand-writes exactly what `FormMessage`
renders. It has no `FormState`, which is why it was skipped — but `FormMessage`
takes `string | null` and nothing else.

**Do:** `<FormMessage>{failed ? "…" : null}</FormMessage>`.

**Verify:** `pnpm verify`. The login page is not otherwise touched.

## Task 10 — Back stops re-applying the search

`components/page/search-field.tsx` keeps the typed query in local state and
replaces the URL from an effect. Press Back and the URL returns to the previous
entry, but the state does not — so the effect sees a mismatch and replaces the
URL forward again. Back looks broken. Inherited from the deleted `RecipeSearch`;
it now affects `/catalogo` too.

**Do:** adopt the URL's value when the URL changes for a reason this box did not
cause. Remember what the box last asked for, so a replace it caused is not
mistaken for a Back — otherwise a slow round trip clobbers characters typed
while it was in flight.

**Do not:** drop the debounce or the no-op guard. Both are load-bearing.

**Verify:** in the browser, on `/catalogo`: type `ac`, wait for the list to
filter, press Back. The URL loses `?q=` and stays lost, and the field empties.
Then type fast enough to outrun one debounce and confirm no character is lost.

---

## Out of scope

- `slot-drawer.tsx`'s literal `aria-describedby="recipe-description"`. It reads
  as a divergence from `catalog-form.tsx`'s `{ described: true }`, but the two
  cases are not the same: the catalogue's control **is** a form field and is
  already being spread, the menu's picker is not a field at all and has nothing
  to spread. Two spellings for two situations. Left alone deliberately.

## Closing

One commit per task is too many for changes this size. Group them:
Tasks 1–2 (the shell and the type), Tasks 3–8 (the action and call-site tidying),
Task 9–10 (the two user-visible ones). `pnpm verify` green before each, and the
browser checks in Tasks 4, 6 and 10 actually run.
