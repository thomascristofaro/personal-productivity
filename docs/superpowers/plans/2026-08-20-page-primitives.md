# Page Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `components/page/` the form, the drawer and the page shell it never got, so a new screen is composed rather than copied.

**Architecture:** One `FormState` shape in `lib/form.ts`, one `useFormState` hook that carries the ARIA wiring, four typed field components plus one `FormField` escape hatch, an always-controlled `FormDrawer`, and shells that know nothing about the header. State reaches fields by explicit spread — no context, no compound components.

**Tech Stack:** Next 16 App Router, React 19 (`useActionState`), Base UI via shadcn/ui, Zod 4, Vitest (node environment), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-20-page-primitives-design.md`

## Global Constraints

- **Branch:** `feat/page-primitives`, already cut from `main` and already holding the spec commit. Never commit to `main`.
- **Layering:** `components/**` and `hooks/**` may not import `lib/services/**`, `lib/db`, `lib/env` or `lib/auth`. ESLint enforces it; a violation fails `pnpm verify`.
- **Language:** Italian for everything a user reads. English for identifiers, file names, comments, commit messages, test names.
- **UI:** every base component comes from `components/ui/` (shadcn). Do not add a library, do not hand-write a base component, do not wrap one to avoid editing it.
- **Tests:** Vitest, node environment, `*.test.ts` beside the code. No jsdom, no testing-library, no Playwright in `package.json`. UI wiring is not unit-tested — see `docs/conventions/testing.md`.
- **Gate:** `pnpm verify` (typecheck + lint + tests) must pass before any task is called done.
- **Comments:** explain only _why_. No section dividers, no commented-out code, no restating the code.
- **Type scale:** Tailwind's, unmodified. Sizes are decided per element at the call site. Do not introduce a theme-wide size change.
- **Behaviour:** only the four changes listed in the spec's "Behaviour changes" section may be visible. Everything else must look and behave exactly as before.

## Corrections to the spec, found while planning

Apply these; they override the spec where they differ.

1. **Typed fields take three of our props, not two:** `label`, `description`, `error`. `fieldProps` returns DOM attributes only, so the error _text_ cannot travel in the spread — it would land on the element as an unknown attribute. Three props, and they never grow.
2. **`ListBody` and `DetailBody` accept `className`,** merged with `cn()`. `/spesa/[weekStart]` needs `pb-24` unconditionally, and the spec's idea of moving it into `CompletePurchaseBar` cannot work: that component returns `null` when nothing is ticked, and the padding has to survive that.
3. **The Zod bundle argument is weaker than the spec states.** `fieldErrorsFrom` needs only `import type { ZodError }`, which is erased at build. The two files stay split by consumer — client-facing versus server-facing — so that the day someone adds a runtime Zod value to the helpers, it is already out of the browser's way.

## File Structure

**Created**

| File                               | Responsibility                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `lib/form.ts`                      | `FormState`, `FormAction`, `EMPTY_FORM_STATE`, `failure`, `success`. Zero imports. |
| `lib/form-errors.ts`               | `fieldErrorsFrom`, `valuesFrom`. Server-side only.                                 |
| `lib/form-errors.test.ts`          | Their tests.                                                                       |
| `lib/search-params.ts`             | `firstOf`.                                                                         |
| `hooks/use-form-state.ts`          | `useFormState`.                                                                    |
| `components/page/page-body.tsx`    | `ListBody`, `DetailBody`.                                                          |
| `components/page/described-by.ts`  | `mergeDescribedBy` — shared by the field components.                               |
| `components/page/fields.tsx`       | `TextField`, `NumberField`, `TextareaField`, `SelectField`.                        |
| `components/page/form-field.tsx`   | `FormField` — the escape hatch.                                                    |
| `components/page/form-message.tsx` | `FormMessage`.                                                                     |
| `components/page/form-actions.tsx` | `FormActions`.                                                                     |
| `components/page/form-drawer.tsx`  | `FormDrawer`.                                                                      |
| `components/page/search-field.tsx` | `SearchField`.                                                                     |
| `components/page/filter-chips.tsx` | `FilterChips`.                                                                     |
| `components/page/list-section.tsx` | `ListSection`.                                                                     |
| `components/page/message-page.tsx` | `MessagePage`.                                                                     |

**Deleted:** `components/recipes/recipe-form-state.ts`, `components/recipes/recipe-search.tsx`, `components/catalog/kind-filter.tsx`, and the `emptySlot` action.

---

# Block A — the shells and the form contract

### Task 1: Page shells

**Files:**

- Create: `components/page/page-body.tsx`
- Modify: all 13 pages listed in Step 2

**Interfaces:**

- Produces: `ListBody({ className?, children })` and `DetailBody({ className?, children })`, both rendering `<main>`.

- [ ] **Step 1: Write the component**

```tsx
// components/page/page-body.tsx
import { cn } from "@/lib/utils"

// Two components rather than one with a `dense` prop: a list and a form are
// different screens, not one screen in two modes.
export function ListBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn("flex flex-col gap-4 pt-6", className)}>
      {children}
    </main>
  )
}

export function DetailBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn("flex flex-col gap-6 pt-6", className)}>
      {children}
    </main>
  )
}
```

- [ ] **Step 2: Replace the `<main>` in every page**

Replace `<main className="flex flex-col gap-4 pt-6">` with `<ListBody>` in:
`app/(app)/catalogo/page.tsx`, `app/(app)/recipes/page.tsx`, `app/(app)/menu/[weekStart]/page.tsx`, `app/(app)/spesa/storico/page.tsx`.

Replace `<main className="flex flex-col gap-6 pt-6">` with `<DetailBody>` in:
`app/(app)/catalogo/new/page.tsx`, `app/(app)/catalogo/[name]/edit/page.tsx`, `app/(app)/recipes/new/page.tsx`, `app/(app)/recipes/[id]/page.tsx`, `app/(app)/recipes/[id]/edit/page.tsx`, `app/(app)/spesa/storico/[id]/page.tsx`.

Replace `<main className="flex flex-col gap-4 pt-6 pb-24">` with `<ListBody className="pb-24">` in `app/(app)/spesa/[weekStart]/page.tsx`. Keep the comment above it explaining why the padding is unconditional.

Leave alone: `app/not-found.tsx`, `app/(app)/not-found.tsx`, `app/(app)/recipes/[id]/not-found.tsx` and `app/login/page.tsx` — they are centred message screens and Task 16 handles them.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS, and `git diff` shows no class name changed — only `<main …>` became `<ListBody>` or `<DetailBody>`.

- [ ] **Step 4: Commit**

```bash
git add components/page/page-body.tsx "app/(app)"
git commit -m "refactor: one page shell instead of thirteen copies of it"
```

---

### Task 2: The form contract

**Files:**

- Create: `lib/form.ts`, `lib/form-errors.ts`, `lib/form-errors.test.ts`

**Interfaces:**

- Produces: `FormState`, `FormAction`, `EMPTY_FORM_STATE`, `failure(message, parts?)`, `success(message?)`, `fieldErrorsFrom(error)`, `valuesFrom(formData, fields)`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/form-errors.test.ts
import { describe, expect, it } from "vitest"

import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import { CatalogItemInputSchema } from "@/lib/schemas/catalog"
import { RecipeInputSchema } from "@/lib/schemas/recipe"

describe("fieldErrorsFrom", () => {
  it("keys each message under its own field", () => {
    const parsed = CatalogItemInputSchema.safeParse({
      name: "",
      kind: "INGREDIENT",
      defaultUnit: "",
      aisle: "",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    const errors = fieldErrorsFrom(parsed.error)

    expect(errors.name).toEqual(["Il nome non può essere vuoto."])
    expect(errors.aisle).toEqual(["Scegli un reparto."])
  })

  it("keys a nested issue under the first segment of its path", () => {
    const parsed = RecipeInputSchema.safeParse({
      title: "Prova",
      sourceUrl: "",
      servings: undefined,
      totalMinutes: undefined,
      instructions: "",
      notes: "",
      tags: [],
      ingredients: [{ ingredientName: "", unit: null, quantity: null }],
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    // The recipe form renders one message for the whole ingredient block, so
    // an issue at ["ingredients", 0, "ingredientName"] has to land on
    // "ingredients" or nothing shows it.
    expect(fieldErrorsFrom(parsed.error).ingredients).toHaveLength(1)
  })

  it("drops an issue that names no field", () => {
    // A server action is a public endpoint: it can be called with anything,
    // and a non-object produces an issue whose path is empty.
    const parsed = CatalogItemInputSchema.safeParse(null)

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(fieldErrorsFrom(parsed.error)).toEqual({})
  })
})

describe("valuesFrom", () => {
  it("reads every named field as a string", () => {
    const data = new FormData()
    data.set("name", "pomodori")
    data.set("aisle", "ortofrutta")

    expect(valuesFrom(data, ["name", "aisle"])).toEqual({
      name: "pomodori",
      aisle: "ortofrutta",
    })
  })

  it("gives an absent field an empty string", () => {
    expect(valuesFrom(new FormData(), ["name"])).toEqual({ name: "" })
  })

  it("gives a non-string entry an empty string", () => {
    const data = new FormData()
    data.set("name", new File(["x"], "x.txt"))

    expect(valuesFrom(data, ["name"])).toEqual({ name: "" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/form-errors.test.ts`
Expected: FAIL — cannot resolve `@/lib/form-errors`.

- [ ] **Step 3: Write `lib/form.ts`**

```ts
// The state every form action returns. Deliberately importless — a client
// component reads this type, and anything imported here reaches the browser
// bundle with it.
export type FormState = {
  ok: boolean
  message: string | null
  // Present even on forms that show no per-field error. One shape avoids the
  // question "which state type does this form use", which is the friction this
  // module exists to remove.
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

/**
 * A refused submit, with what the user typed so the form can put it back.
 *
 * @param message - what to tell the user, in Italian
 * @param parts - per-field errors and the echoed values
 * @returns a state whose `ok` is false
 */
export function failure(
  message: string,
  parts: {
    errors?: Record<string, string[]>
    values?: Record<string, string>
  } = {}
): FormState {
  return {
    ok: false,
    message,
    errors: parts.errors ?? {},
    values: parts.values ?? {},
  }
}

/**
 * A submit that worked.
 *
 * Only read by screens that stay open — an action that redirects never returns.
 *
 * @param message - an optional note to show afterwards
 * @returns a state whose `ok` is true
 */
export function success(message: string | null = null): FormState {
  return { ok: true, message, errors: {}, values: {} }
}
```

- [ ] **Step 4: Write `lib/form-errors.ts`**

```ts
import type { ZodError } from "zod"

/**
 * Groups a Zod error's messages by the field they belong to.
 *
 * Built from `issues` rather than a version-specific flatten helper. A nested
 * path keys under its first segment, so an issue inside an ingredient row
 * reaches the one message the recipe form renders for the whole block.
 *
 * @param error - the error from a failed `safeParse`
 * @returns field name to its messages; an issue naming no field is dropped
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== "string") continue
    errors[field] = [...(errors[field] ?? []), issue.message]
  }

  return errors
}

/**
 * Echoes exactly what was submitted.
 *
 * React 19 resets an uncontrolled form to its `defaultValue`s before the action
 * runs, so a refused save loses what was typed unless it comes back in the
 * state.
 *
 * @param formData - the submitted form
 * @param fields - the field names to echo
 * @returns every named field as a string; anything absent or non-string as ""
 */
export function valuesFrom(
  formData: FormData,
  fields: readonly string[]
): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of fields) {
    const value = formData.get(field)
    values[field] = typeof value === "string" ? value : ""
  }

  return values
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test lib/form-errors.test.ts`
Expected: PASS, 6 tests.

If the first test fails on an exact message, read the message the schema actually produced and fix the assertion — the schema is the source of truth, not this plan.

- [ ] **Step 6: Commit**

```bash
git add lib/form.ts lib/form-errors.ts lib/form-errors.test.ts
git commit -m "feat: one form state, and the two helpers both actions had copied"
```

---

### Task 3: The `useFormState` hook

**Files:**

- Create: `hooks/use-form-state.ts`

**Interfaces:**

- Consumes: `EMPTY_FORM_STATE`, `FormAction`, `FormState` from `@/lib/form`; `useAttempt` from `@/hooks/use-attempt`.
- Produces: `useFormState(action, fieldOrder, initialValues?)` returning `{ state, formAction, isPending, attempt, errorOf, fieldProps }`, and the type `FieldProps`.

- [ ] **Step 1: Write the hook**

```ts
"use client"

import { useActionState, useEffect } from "react"

import { useAttempt } from "@/hooks/use-attempt"
import { EMPTY_FORM_STATE, type FormAction } from "@/lib/form"

export type FieldProps = {
  id: string
  name: string
  defaultValue: string
  "aria-invalid"?: true
  "aria-describedby"?: string
}

/**
 * Everything a form needs from its action, in one call.
 *
 * @param action - the server action, typed as FormAction
 * @param fieldOrder - DOM order of the flat fields, so the first invalid one can
 *   take focus. Must be a module-level constant: a fresh array on every render
 *   would re-run the focus effect.
 * @param initialValues - what the server sent, used when the state carries nothing
 * @returns the action state, the pending flag, the remount counter, and the
 *   per-field helpers
 */
export function useFormState(
  action: FormAction,
  fieldOrder: readonly string[],
  initialValues: Record<string, string> = {}
) {
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_FORM_STATE
  )
  const attempt = useAttempt(state)

  useEffect(() => {
    const firstInvalid = fieldOrder.find((field) => state.errors[field]?.length)
    if (firstInvalid !== undefined) {
      document.getElementById(firstInvalid)?.focus()
    }
  }, [state, fieldOrder])

  const errorOf = (field: string) => state.errors[field]?.[0]

  // DOM attributes only. The error *text* is not here on purpose: it would land
  // on the element as an unknown attribute. Field components take it as a prop.
  const fieldProps = (
    field: string,
    options: { described?: boolean } = {}
  ): FieldProps => {
    const ids = [
      options.described ? `${field}-description` : null,
      errorOf(field) ? `${field}-error` : null,
    ].filter((id) => id !== null)

    return {
      id: field,
      name: field,
      // The echoed value wins over the server's: after a refusal it is what the
      // user typed, and on a fresh render there is none.
      defaultValue: state.values[field] ?? initialValues[field] ?? "",
      "aria-invalid": errorOf(field) ? true : undefined,
      "aria-describedby": ids.length === 0 ? undefined : ids.join(" "),
    }
  }

  return { state, formAction, isPending, attempt, errorOf, fieldProps }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-form-state.ts
git commit -m "feat: the four closures every form copied, written once"
```

---

### Task 4: The field layer

**Files:**

- Create: `components/page/described-by.ts`, `components/page/fields.tsx`, `components/page/form-field.tsx`, `components/page/form-message.tsx`, `components/page/form-actions.tsx`

**Interfaces:**

- Consumes: `FieldProps` from `@/hooks/use-form-state`.
- Produces: `TextField`, `NumberField`, `TextareaField`, `SelectField`, `FormField`, `FormMessage`, `FormActions`. Every field component takes `label: string`, `description?: string`, `error?: string`, plus the spread from `fieldProps`. `SelectField` additionally takes `options`.

- [ ] **Step 1: The shared ARIA merge**

```ts
// components/page/described-by.ts

/**
 * Adds the description's id to whatever `fieldProps` already produced.
 *
 * `fieldProps` emits only the error's id, because it does not know whether the
 * call site passed a description. The field component does.
 *
 * @param id - the field's id, which the description's id is built from
 * @param hasDescription - whether a description is being rendered
 * @param fromField - the `aria-describedby` that arrived in the spread
 * @returns the merged value, or undefined when there is nothing to point at
 */
export function mergeDescribedBy(
  id: string,
  hasDescription: boolean,
  fromField: string | undefined
): string | undefined {
  const ids = [hasDescription ? `${id}-description` : null, fromField ?? null]
    .filter((value) => value !== null)
    .join(" ")

  return ids === "" ? undefined : ids
}
```

- [ ] **Step 2: The four typed fields**

```tsx
"use client"

import { mergeDescribedBy } from "@/components/page/described-by"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// These components define `label`, `description` and `error` and nothing else.
// Everything else spreads onto the native control, so `min`, `step`, `rows`,
// `type`, `inputMode`, `placeholder` and `required` pass through as the DOM
// attributes they already are. Without that rule NumberField grows a `min` in
// week one and an `allowDecimals` in week two.
type Ours = { label: string; description?: string; error?: string }

export function TextField({
  label,
  description,
  error,
  ...control
}: React.ComponentProps<typeof Input> & Ours) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={control.id}>{label}</FieldLabel>
      <Input
        {...control}
        aria-describedby={mergeDescribedBy(
          String(control.id),
          description !== undefined,
          control["aria-describedby"]
        )}
      />
      {description === undefined ? null : (
        <FieldDescription id={`${control.id}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${control.id}-error`}>{error}</FieldError>
    </Field>
  )
}

export function NumberField(props: React.ComponentProps<typeof Input> & Ours) {
  return <TextField type="number" inputMode="numeric" {...props} />
}

export function TextareaField({
  label,
  description,
  error,
  ...control
}: React.ComponentProps<typeof Textarea> & Ours) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={control.id}>{label}</FieldLabel>
      <Textarea
        {...control}
        aria-describedby={mergeDescribedBy(
          String(control.id),
          description !== undefined,
          control["aria-describedby"]
        )}
      />
      {description === undefined ? null : (
        <FieldDescription id={`${control.id}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${control.id}-error`}>{error}</FieldError>
    </Field>
  )
}

export function SelectField({
  label,
  description,
  error,
  options,
  id,
  name,
  defaultValue,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  ...rest
}: Ours & {
  id: string
  name: string
  defaultValue?: string
  "aria-invalid"?: true
  "aria-describedby"?: string
  // A list when the value and the label are the same string — the aisles. A map
  // when they differ — INGREDIENT to "Ingrediente". Base UI's Select.Value
  // renders the raw value unless the root is given the map, which is why this
  // is one prop and not two.
  options: readonly string[] | Record<string, string>
  value?: string
  onValueChange?: (value: string | null) => void
}) {
  const entries: [string, string][] = Array.isArray(options)
    ? options.map((option) => [option, option])
    : Object.entries(options)
  const items = Array.isArray(options) ? undefined : options

  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select name={name} defaultValue={defaultValue} items={items} {...rest}>
        <SelectTrigger
          id={id}
          aria-invalid={invalid}
          aria-describedby={mergeDescribedBy(
            id,
            description !== undefined,
            describedBy
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map(([value, optionLabel]) => (
            <SelectItem key={value} value={value}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description === undefined ? null : (
        <FieldDescription id={`${id}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  )
}
```

If TypeScript refuses to narrow `Array.isArray` on `readonly string[] | Record<string, string>`, replace the two ternaries with `const isList = Array.isArray(options)` and use that.

- [ ] **Step 3: The escape hatch**

```tsx
// components/page/form-field.tsx
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

// For controls the typed four cannot carry: a picker, a datalist, a checkbox.
// Reaching for this is normal, not a failure. The call site writes the control,
// so it also passes `{ described: true }` to fieldProps when there is a
// description — this component cannot reach into its children to do it.
export function FormField({
  name,
  label,
  description,
  error,
  children,
}: {
  name: string
  label: string
  description?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children}
      {description === undefined ? null : (
        <FieldDescription id={`${name}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </Field>
  )
}
```

- [ ] **Step 4: The message and the actions**

```tsx
// components/page/form-message.tsx
export function FormMessage({ children }: { children: string | null }) {
  if (children === null) return null

  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}
```

```tsx
// components/page/form-actions.tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"

export function FormActions({
  cancelHref,
  isPending,
  submitLabel = "Salva",
  pendingLabel = "Salvo…",
}: {
  cancelHref: string
  isPending: boolean
  submitLabel?: string
  pendingLabel?: string
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
      <Button
        variant="ghost"
        render={
          <Link
            href={cancelHref}
            // Discarding is the whole point of this link, so the unsaved
            // changes guard steps aside for it.
            data-discard=""
          />
        }
        nativeButton={false}
      >
        Annulla
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS. Nothing imports these yet, so this only proves they compile and satisfy the layering rules.

- [ ] **Step 6: Commit**

```bash
git add components/page
git commit -m "feat: four typed fields, one escape hatch, and the two paragraphs everyone copied"
```

---

### Task 5: `CatalogForm` on the new contract

**Files:**

- Modify: `components/catalog/catalog-form.tsx`, `app/(app)/catalogo/actions.ts`

**Interfaces:**

- Consumes: `useFormState`, `TextField`, `SelectField`, `FormField`, `FormMessage`, `FormActions`, `failure`, `fieldErrorsFrom`, `valuesFrom`.
- Produces: `CatalogFormValues` unchanged. `CatalogFormState` and `SaveCatalogItemAction` are **deleted** — the action is now typed `FormAction`.

- [ ] **Step 1: Rewrite the component**

```tsx
"use client"

import { SelectField, TextField } from "@/components/page/fields"
import { FormActions } from "@/components/page/form-actions"
import { FormField } from "@/components/page/form-field"
import { FormMessage } from "@/components/page/form-message"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

export type CatalogFormValues = {
  // Absent when creating. Carried as a hidden field so a rename knows which row
  // to update: the name is the primary key, so the new value cannot identify
  // the old row.
  originalName?: string
  name: string
  kind: string
  defaultUnit: string
  aisle: string
}

// DOM order, so the first invalid field takes focus. Module-level: a fresh
// array on every render would re-run the hook's focus effect.
const FIELD_ORDER = ["name", "kind", "defaultUnit", "aisle"] as const

// The stored values are English because they are database values; the labels
// are Italian because they are what the user reads.
const KIND_LABELS: Record<string, string> = {
  INGREDIENT: "Ingrediente",
  PRODUCT: "Prodotto",
}

export function CatalogForm({
  values,
  action,
  aisles,
  units,
}: {
  values: CatalogFormValues
  action: FormAction
  aisles: readonly string[]
  units: string[]
}) {
  // An explicit object, not `values`: CatalogFormValues has an optional
  // `originalName`, which is not assignable to Record<string, string>.
  const { state, formAction, isPending, attempt, errorOf, fieldProps } =
    useFormState(action, FIELD_ORDER, {
      name: values.name,
      kind: values.kind,
      defaultUnit: values.defaultUnit,
      aisle: values.aisle,
    })

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {values.originalName === undefined ? null : (
        <input type="hidden" name="originalName" value={values.originalName} />
      )}

      <FieldGroup key={attempt}>
        <TextField
          {...fieldProps("name")}
          label="Nome"
          error={errorOf("name")}
          autoComplete="off"
          required
        />

        <SelectField
          {...fieldProps("kind")}
          label="Tipo"
          error={errorOf("kind")}
          description="Solo un ingrediente si può scegliere dentro una ricetta."
          options={KIND_LABELS}
        />

        <FormField
          name="defaultUnit"
          label="Unità preferita"
          error={errorOf("defaultUnit")}
          description="Riempie la riga della ricetta. Lascia vuoto se si conta a pezzi."
        >
          <Input
            {...fieldProps("defaultUnit", { described: true })}
            list="unit-suggestions"
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="unit-suggestions">
            {units.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </FormField>

        <SelectField
          {...fieldProps("aisle")}
          label="Reparto"
          error={errorOf("aisle")}
          description="Decide dove finisce nella lista della spesa."
          options={aisles}
        />
      </FieldGroup>

      <FormMessage>{state.message}</FormMessage>
      <FormActions cancelHref="/catalogo" isPending={isPending} />
    </form>
  )
}
```

Note: the `originalName` hidden field now reads `values.originalName` directly. The old `valueOf("originalName")` echoed a field that is never edited, so the echo bought nothing.

- [ ] **Step 2: Rewrite the action's plumbing**

In `app/(app)/catalogo/actions.ts`: delete the local `valuesFrom` and `fieldErrorsFrom`, import them from `@/lib/form-errors`, and replace the state type.

```ts
import { failure, type FormAction, type FormState } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"

const FORM_FIELDS = [
  "originalName",
  "name",
  "kind",
  "defaultUnit",
  "aisle",
] as const

export const saveCatalogItem: FormAction = async (_state, formData) => {
  // …parsing unchanged…

  if (!parsed.success) {
    return failure("Controlla i campi segnalati.", {
      errors: fieldErrorsFrom(parsed.error),
      values: valuesFrom(formData, FORM_FIELDS),
    })
  }

  // …unchanged through to the catch block…

  if (error instanceof CatalogItemExistsError) {
    return failure("Controlla i campi segnalati.", {
      errors: { name: ["Esiste già una voce con questo nome."] },
      values: valuesFrom(formData, FORM_FIELDS),
    })
  }
  // …the three remaining `failure(...)` calls take only a message and values…
}
```

Keep every existing message, every `revalidatePath`, and the `redirect(…, RedirectType.replace)`. `removeCatalogItem` is untouched.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/catalog/catalog-form.tsx "app/(app)/catalogo/actions.ts"
git commit -m "refactor: the catalogue form stops carrying its own scaffolding"
```

---

### Task 6: `RecipeForm` on the new contract

**Files:**

- Modify: `components/recipes/recipe-form.tsx`, `app/(app)/recipes/actions.ts`
- Delete: `components/recipes/recipe-form-state.ts`

**Interfaces:**

- Consumes: the same set as Task 5, plus `TextareaField`.
- Produces: `RecipeFormValues` unchanged. `RecipeFormState`, `EMPTY_FORM_STATE` (the local one) and `SaveRecipeAction` are deleted.

- [ ] **Step 1: Rewrite the component**

Keep everything that is specific to recipes: `useUnsavedChanges` with the `dirty` state armed by `onInput`, the hidden `notes` input, the two `<fieldset>` blocks around `IngredientRows` and `TagPicker` with their own `role="alert"` paragraphs, and the `grid grid-cols-2` around porzioni and minuti.

Replace the four closures and the focus effect with:

```tsx
const FIELD_ORDER = [
  "title",
  "servings",
  "totalMinutes",
  "instructions",
  "sourceUrl",
] as const

const { state, formAction, isPending, attempt, errorOf, fieldProps } =
  useFormState(action, FIELD_ORDER, {
    title: values.title,
    sourceUrl: values.sourceUrl,
    servings: values.servings,
    totalMinutes: values.totalMinutes,
    instructions: values.instructions,
    notes: values.notes,
  })
```

Replace each flat field with its typed component:

```tsx
<TextField
  {...fieldProps("title")}
  label="Nome"
  error={errorOf("title")}
  // Not a field a password manager or an address autofill has any business
  // completing. Without it "Nome" gets offered a saved identity.
  autoComplete="off"
  required
/>

<div className="grid grid-cols-2 gap-4">
  <NumberField
    {...fieldProps("servings")}
    label="Porzioni"
    error={errorOf("servings")}
    min={1}
    autoComplete="off"
  />
  <NumberField
    {...fieldProps("totalMinutes")}
    label="Minuti"
    error={errorOf("totalMinutes")}
    min={1}
    autoComplete="off"
  />
</div>

<TextareaField
  {...fieldProps("instructions")}
  label="Preparazione"
  error={errorOf("instructions")}
  rows={14}
  autoComplete="off"
/>

<TextField
  {...fieldProps("sourceUrl")}
  label="Fonte"
  error={errorOf("sourceUrl")}
  type="url"
  inputMode="url"
  spellCheck={false}
  autoComplete="off"
/>
```

The hidden `notes` input becomes `value={state.values.notes ?? values.notes}`, and the hidden `id` input `value={values.id}`.

Footer: `<FormMessage>{state.message}</FormMessage>` and
`<FormActions cancelHref={values.id ? \`/recipes/${values.id}\` : "/recipes"} isPending={isPending} />`.

- [ ] **Step 2: Rewrite the action's plumbing**

In `app/(app)/recipes/actions.ts`: delete the local `valuesFrom` and `fieldErrorsFrom`, import from `@/lib/form-errors`, type `saveRecipe` as `FormAction`, and replace each returned object with `failure(...)`. `valuesFrom(formData, FORM_FIELDS)` replaces the local version; the `id` that the old helper appended is now listed in `FORM_FIELDS`:

```ts
const FORM_FIELDS = [
  "title",
  "sourceUrl",
  "servings",
  "totalMinutes",
  "instructions",
  "notes",
  "id",
] as const
```

Keep `optionalNumber`, `ingredientRowsFrom` and `tagsFrom` where they are — they are about recipes, not about forms. `addIngredient` and `removeRecipe` are untouched.

- [ ] **Step 3: Delete the dead module**

```bash
git rm components/recipes/recipe-form-state.ts
```

- [ ] **Step 4: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A components/recipes "app/(app)/recipes/actions.ts"
git commit -m "refactor: the recipe form keeps only what is about recipes"
```

---

### Task 7: `PurchaseTotalForm` on the new contract

**Files:**

- Modify: `components/shopping/purchase-total-form.tsx`, `app/(app)/spesa/storico/actions.ts`

**Interfaces:**

- Produces: `TotalState`, `SaveTotalAction` and `EMPTY_TOTAL_STATE` are deleted.

- [ ] **Step 1: Rewrite the component**

```tsx
"use client"

import { TextField } from "@/components/page/fields"
import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

const FIELD_ORDER = ["total"] as const

export function PurchaseTotalForm({
  id,
  // Already formatted for editing — "12,34", not "12,34 €" — because this is a
  // field and not a reading.
  total,
  action,
}: {
  id: string
  total: string
  action: FormAction
}) {
  const { state, formAction, isPending, attempt, errorOf, fieldProps } =
    useFormState(action, FIELD_ORDER, { total })

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <div key={attempt}>
        <TextField
          {...fieldProps("total")}
          label="Quanto hai pagato"
          error={errorOf("total")}
          description="Svuota il campo per togliere l’importo."
          // Text and not number: a number input refuses a comma in some locales
          // and silently empties itself, and the parsing this field needs is
          // already in EuroCentsSchema.
          type="text"
          inputMode="decimal"
          placeholder="12,34"
          autoComplete="off"
        />
      </div>

      <FormMessage>{state.message}</FormMessage>

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Salvo…" : "Salva l’importo"}
      </Button>
    </form>
  )
}
```

Two things to note. The `key={attempt}` moves to a wrapping `div` because there is no `FieldGroup` here — a single field still has to remount so React 19's reset cannot fight the value the server sent back. And `fieldProps` is called **without** `{ described: true }`: `TextField` merges the description's id itself, and passing the option too would list it twice.

- [ ] **Step 2: Rewrite the action**

```ts
export const saveTotal: FormAction = async (_state, formData) => {
  const id = PurchaseIdSchema.safeParse(formData.get("id"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  if (!id.success) return failure("Questa spesa non è valida.")
  if (!total.success) {
    return failure(total.error.issues[0].message, {
      values: valuesFrom(formData, ["total"]),
    })
  }

  await requireSession()
  await setPurchaseTotal(id.data, total.data)

  revalidatePath("/spesa/storico")
  revalidatePath(`/spesa/storico/${id.data}`)
  return success()
}
```

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/shopping/purchase-total-form.tsx "app/(app)/spesa/storico/actions.ts"
git commit -m "refactor: the purchase total form joins the contract"
```

---

### Task 8: Browser checklist A

**Files:** none — this task changes nothing. It either passes or it produces bug fixes.

Drive the app at 390px through the `playwright` MCP server. This is a way of running a written checklist, not an end-to-end test suite: nothing Playwright-shaped goes into `package.json`.

- [ ] **Step 1: Start the app**

Run: `pnpm dev`
If every route 404s while the server says Ready, delete `.next` and start again.

- [ ] **Step 2: Walk the shells**

Open each of the 13 pages and confirm the vertical rhythm is unchanged: `/menu`, `/spesa`, `/spesa/storico`, a purchase from the history, `/recipes`, a recipe, its edit page, `/recipes/new`, `/catalogo`, an entry's edit page, `/catalogo/new`. Confirm `/spesa` still has empty space below the last row for the fixed bar.

- [ ] **Step 3: The catalogue form**

Create an entry: valid save redirects to `/catalogo` and Back does not land on the form. Save with an empty name: the message appears, focus lands on Nome, and the Tipo, Unità and Reparto values you had chosen are still there. Type `2` into Unità: the refusal says the quantity goes in the field beside it. Rename an existing entry and confirm the old row is gone. Press Annulla and confirm it leaves without a prompt.

- [ ] **Step 4: The recipe form**

Create a recipe with one ingredient. Save with an empty title: the message appears, focus lands on Nome, and the ingredient rows, the tags, the porzioni and the preparazione survive. Add a second ingredient, remove the first, and confirm the right row disappeared. Type in a field then press Annulla: no prompt. Type in a field then use the browser Back: the unsaved-changes prompt appears.

- [ ] **Step 5: The purchase total**

Open a purchase from `/spesa/storico`, type `12,34`, save, and confirm the reading above shows `12,34 €`. Empty the field and save: the amount goes away and the list shows the «totale da inserire» badge.

- [ ] **Step 6: Commit any fixes**

```bash
git commit -m "fix: <what the checklist found>"
```

If the checklist found nothing, record that in the task notes and move on. Do not commit an empty change.

---

# Block B — the drawer

### Task 9: `FormDrawer`

**Files:**

- Create: `components/page/form-drawer.tsx`

**Interfaces:**

- Consumes: `useFormState`'s return value, passed whole as `form`.
- Produces: `FormDrawer({ open, onOpenChange, form, title, description, submitLabel, pendingLabel, children })`.

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useState } from "react"

import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { FieldGroup } from "@/components/ui/field"
import type { useFormState } from "@/hooks/use-form-state"

type Form = ReturnType<typeof useFormState>

// Always controlled, and it does not own the hook: one rule for the whole
// layer, and the three triggers in this app — a floating button, a fixed bar,
// and a parent holding the open slot — stay three different things, which is
// what they are.
export function FormDrawer({
  open,
  onOpenChange,
  form,
  title,
  description,
  submitLabel,
  pendingLabel,
  submitDisabled = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: Form
  title: string
  description?: string
  submitLabel: string
  pendingLabel: string
  // For a guard the drawer cannot see — the add-item drawer keeps the name in
  // its own state and refuses to submit an empty one. Not a mode: it is the
  // button's own `disabled`, reached from outside.
  submitDisabled?: boolean
  children: React.ReactNode
}) {
  // Adjusting state during render rather than in an effect: React re-runs the
  // component before committing, so the drawer never paints open after a
  // successful save. An effect here would be a cascading render, which is what
  // react-hooks/set-state-in-effect objects to.
  const [seen, setSeen] = useState(form.attempt)

  if (seen !== form.attempt) {
    setSeen(form.attempt)
    if (form.state.ok) onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description === undefined ? null : (
            <DrawerDescription>{description}</DrawerDescription>
          )}
        </DrawerHeader>

        <form action={form.formAction} className="flex flex-col gap-6 px-4">
          <FieldGroup key={form.attempt}>{children}</FieldGroup>

          <FormMessage>{form.state.message}</FormMessage>

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={form.isPending || submitDisabled}>
              {form.isPending ? pendingLabel : submitLabel}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/page/form-drawer.tsx
git commit -m "feat: one drawer, and close-on-success written once instead of four times"
```

---

### Task 10: The slot drawer, and the asymmetry behind «Svuota»

**Files:**

- Modify: `components/menu/recipe-picker.tsx`, `lib/services/menus.ts:128-156`, `app/(app)/menu/[weekStart]/actions.ts`, `components/menu/slot-drawer.tsx`, `components/menu/week-grid.tsx`

**Interfaces:**

- `RecipePicker`'s `onSelect` becomes `(recipe: RecipeOption | null) => void`.
- `SlotDrawer` no longer takes `clearAction`; `WeekGrid` no longer takes or forwards it.
- `emptySlot` is deleted from the actions file.

- [ ] **Step 1: Let the picker be cleared**

In `components/menu/recipe-picker.tsx`, widen the callback and pass `showClear`:

```tsx
onSelect: (recipe: RecipeOption | null) => void
…
<Combobox
  autoComplete="off"
  items={recipes}
  itemToStringLabel={(recipe: RecipeOption) => recipe.title}
  isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
  value={value}
  // The null is no longer discarded: clearing the field is how a slot holding a
  // recipe is emptied, now that «Svuota» is gone.
  onValueChange={onSelect}
>
  <ComboboxInput
    id={id}
    aria-describedby={describedBy}
    placeholder="Cerca una ricetta…"
    showClear
  />
```

- [ ] **Step 2: Make an empty save delete the row**

In `lib/services/menus.ts`, at the top of `setSlot`:

```ts
// An empty slot and an absent slot must mean the same thing — see clearSlot's
// reasoning below. Writing a row with three nulls would break that, and the
// drawer now reaches this path every time somebody clears a slot by hand.
if (
  input.recipeId === null &&
  input.freeText === null &&
  input.servings === null
) {
  return clearSlot(weekStart, day, meal)
}
```

`clearSlot` is declared later in the same module, so hoisting applies. Update `setSlot`'s TSDoc to say so.

- [ ] **Step 3: Delete `emptySlot`**

Remove the whole `emptySlot` export from `app/(app)/menu/[weekStart]/actions.ts` and the now-unused `clearSlot` import. Retype `saveSlot` as `FormAction`, replacing `SlotFormState` — its returns become `failure("Questo slot non esiste.", { values })`, `failure(input.error.issues[0].message, { values })`, `failure("Questa ricetta non esiste più.", { values })` and `success()`, where `values` is `valuesFrom(formData, ["freeText", "servings"])`.

- [ ] **Step 4: Rewrite `SlotDrawer`**

```tsx
"use client"

import { useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { FormDrawer } from "@/components/page/form-drawer"
import { FormField } from "@/components/page/form-field"
import { NumberField, TextField } from "@/components/page/fields"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

const FIELD_ORDER = ["freeText", "servings"] as const

export function SlotDrawer({
  open,
  onClose,
  slot,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
}: {
  open: boolean
  onClose: () => void
  slot: SlotDrawerValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  const form = useFormState(saveAction, FIELD_ORDER, {
    freeText: slot.freeText ?? "",
    servings: slot.servings === null ? "" : String(slot.servings),
  })

  const [picked, setPicked] = useState<RecipeOption | null>(
    slot.recipeId === null || slot.recipeTitle === null
      ? null
      : { id: slot.recipeId, title: slot.recipeTitle }
  )

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      form={form}
      title={`${dayLabel} · ${mealLabel}`}
      description="Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina. Svuota i campi per liberare lo slot."
      submitLabel="Salva"
      pendingLabel="Salvo…"
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="day" value={slot.day} />
      <input type="hidden" name="meal" value={slot.meal} />
      <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

      <FormField
        name="recipe"
        label="Ricetta"
        description="Scrivi per filtrare il ricettario. La ✕ la toglie."
      >
        <RecipePicker
          id="recipe"
          recipes={recipes}
          value={picked}
          onSelect={setPicked}
          aria-describedby="recipe-description"
        />
      </FormField>

      <TextField
        {...form.fieldProps("freeText")}
        label="Oppure una nota"
        error={form.errorOf("freeText")}
        description="Una nota non finisce nella lista della spesa."
        autoComplete="off"
        placeholder="fuori a cena…"
      />

      <NumberField
        {...form.fieldProps("servings")}
        label="Porzioni"
        error={form.errorOf("servings")}
        description="Lascia vuoto per le porzioni di casa."
        min={1}
        max={20}
        autoComplete="off"
      />
    </FormDrawer>
  )
}
```

The hidden inputs sit inside `FieldGroup` rather than beside it; a hidden input renders nothing, so the group's gap is unaffected.

- [ ] **Step 5: Update `WeekGrid` and the page**

Remove the `clearAction` prop from `WeekGrid`'s signature and from the `SlotDrawer` it renders. In `app/(app)/menu/[weekStart]/page.tsx`, stop importing and passing `emptySlot`.

- [ ] **Step 6: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A components/menu lib/services/menus.ts "app/(app)/menu"
git commit -m "feat: a recipe can be un-picked, so Svuota is not the only way out"
```

---

### Task 11: `AddItemDrawer`

**Files:**

- Modify: `components/shopping/add-item-drawer.tsx`, `app/(app)/spesa/[weekStart]/actions.ts`

- [ ] **Step 1: Rewrite the component**

Keep, unchanged: the floating button with its `fixed`/`aboveBar` classes and safe-area insets, the `choose` function that fills the aisle and unit from the catalogue, the `isNew` case-insensitive test, and the `IngredientPicker` in a `FormField`.

Replace the hand-rolled `seen`/`attempt` block with `useFormState`; the drawer's own `open` state and the button stay outside `FormDrawer`. The reset of `name`, `aisle` and `unit` on success moves into a render-phase check keyed on `form.attempt`, exactly as it is today but reading the hook's counter.

The quantity, unit, aisle and kind fields become:

```tsx
<div className="flex gap-2">
  <NumberField
    {...form.fieldProps("quantity")}
    label="Quantità"
    error={form.errorOf("quantity")}
    // Not min={0}: the schema rejects a quantity of zero, and the browser can
    // refuse it before the drawer has to explain it.
    min={0.01}
    step="any"
    inputMode="decimal"
    autoComplete="off"
  />
  <TextField
    {...form.fieldProps("unit")}
    label="Unità"
    error={form.errorOf("unit")}
    value={unit}
    onChange={(event) => setUnit(event.target.value)}
    autoComplete="off"
    spellCheck={false}
  />
</div>

<SelectField
  {...form.fieldProps("aisle")}
  label="Reparto"
  error={form.errorOf("aisle")}
  options={aisles}
  value={aisle}
  // Base UI reports a cleared selection as null. There is no "no aisle" state
  // here — the list sorts by it — so a clear falls back to the catch-all.
  onValueChange={(next: string | null) => setAisle(next ?? AISLE_UNKNOWN)}
/>

{isNew ? (
  <>
    <SelectField
      {...form.fieldProps("kind")}
      label="Tipo"
      error={form.errorOf("kind")}
      description="Prodotto di default: quello che si cucina di solito nasce dalla ricetta."
      options={KIND_LABELS}
      defaultValue="PRODUCT"
    />
    <Field orientation="horizontal">
      <Checkbox id="skipCatalog" name="skipCatalog" value="1" />
      <FieldLabel htmlFor="skipCatalog">Non salvare nel catalogo</FieldLabel>
    </Field>
  </>
) : null}
```

The two controlled fields overwrite `value`/`onChange` and `value`/`onValueChange` **after** the spread — that is the whole reason the spread comes first. The «Tipo» description now reaches screen readers, because `SelectField` wires it.

The name lives in this component's own state, not in the form, so `FormDrawer` cannot see it. Keep the existing guard by passing it down: `submitDisabled={name.trim() === ""}`.

- [ ] **Step 2: Retype the action**

`addItem` becomes a `FormAction`; its returns become `failure(...)` and `success()`. `toggle`, `removeItem`, `restoreItem`, `setTaken` and `regenerate` are plain `(formData) => Promise<void>` actions and are untouched.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/shopping/add-item-drawer.tsx "app/(app)/spesa/[weekStart]/actions.ts"
git commit -m "refactor: the add-item drawer on the shared drawer"
```

---

### Task 12: `CompletePurchaseBar`

**Files:**

- Modify: `components/shopping/complete-purchase-bar.tsx`, `app/(app)/spesa/[weekStart]/actions.ts`

- [ ] **Step 1: Rewrite the component**

Keep the fixed bar with its `inset-x-0 bottom-0` classes and the safe-area padding, and keep the `if (checkedCount === 0) return null` guard with its comment. Replace the hand-rolled `seen`/`attempt` with `useFormState` and wrap the field in `FormDrawer`:

```tsx
const FIELD_ORDER = ["total"] as const

const form = useFormState(action, FIELD_ORDER)
const [open, setOpen] = useState(false)
```

```tsx
<FormDrawer
  open={open}
  onOpenChange={setOpen}
  form={form}
  title="Spesa completata"
  description={
    checkedCount === 1
      ? "1 articolo passa nello storico e sparisce dalla lista."
      : `${checkedCount} articoli passano nello storico e spariscono dalla lista.`
  }
  submitLabel="Conferma"
  pendingLabel="Salvo…"
>
  <input type="hidden" name="weekStart" value={weekStart} />
  <TextField
    {...form.fieldProps("total")}
    label="Quanto hai pagato"
    error={form.errorOf("total")}
    description="Puoi lasciarlo vuoto e metterlo dopo, dallo storico."
    type="text"
    inputMode="decimal"
    placeholder="12,34"
    autoComplete="off"
  />
</FormDrawer>
```

Keep the comment explaining why there is no separate «Salta» button.

The bar's own button stays outside `FormDrawer`, in the `fixed` div, as it is today.

- [ ] **Step 2: Retype `complete`**

`complete` becomes a `FormAction`; its returns become `failure(...)` and `success()`.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/shopping/complete-purchase-bar.tsx "app/(app)/spesa/[weekStart]/actions.ts"
git commit -m "refactor: the till bar on the shared drawer"
```

---

### Task 13: Browser checklist B

- [ ] **Step 1: The slot drawer, and clearing a slot**

At 390px, open `/menu`. Tap an empty slot, pick a recipe, save: the drawer closes by itself and the day shows the title. Reopen it: the picker shows the recipe, not a blank field. Tap the ✕, save: the slot reads «Vuoto». Confirm in `pnpm db:studio` that no `MenuSlot` row remains for that day and meal.

Open another slot, type a note, save. Reopen, clear the note, save: the slot empties. Open a third, type a note longer than 80 characters and save: the message appears and the note you typed is still in the field.

Open a slot, pick a recipe **and** type a note, save: the refusal says a slot holds one or the other, and both values survive.

- [ ] **Step 2: The add-item drawer**

On `/spesa`, tap the round button. Confirm it sits above the till bar when something is ticked and at the bottom when nothing is. Pick a catalogue entry: the reparto and the unità fill in by themselves. Add it: the drawer closes, the row appears in the right aisle, and reopening the drawer shows empty fields. Type a name the catalogue does not have: the Tipo and «Non salvare nel catalogo» fields appear, and the Tipo description is read out by a screen reader — the gap this work closes. Open the drawer without typing anything and confirm «Aggiungi» is disabled.

- [ ] **Step 3: The till bar**

Tick two rows. The bar appears reading «Spesa completata (2)». Tap it, type `31,50`, confirm: the drawer closes, the two rows leave the list, and `/spesa/storico` shows a new purchase at `31,50 €`. Tick one more, confirm with the field empty, and check the history row shows the «totale da inserire» badge.

- [ ] **Step 4: Safe areas**

With the app installed to the home screen, confirm the round button and the fixed bar clear the home indicator.

- [ ] **Step 5: Commit any fixes**

---

# Block C — the lists

### Task 14: `ListSection`

**Files:**

- Create: `components/page/list-section.tsx`
- Modify: `components/shopping/shopping-list.tsx:80-98`, `app/(app)/spesa/storico/[id]/page.tsx:65-92`, `components/shopping/dismissed-list.tsx:26-62`

- [ ] **Step 1: Write the component**

```tsx
import { cn } from "@/lib/utils"

// The section, not a list of sections: two callers map over aisle groups and a
// third has a single section with a fixed title. A component taking the groups
// would force that third one to pass an array of one.
export function ListSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}
```

- [ ] **Step 2: Use it in the three call sites**

`ShoppingList`: replace the `<section>`/`<h2>`/`<ul>` inside `groups.map` with `<ListSection key={group.aisle} title={group.aisle}>`.

`spesa/storico/[id]/page.tsx`: the same, and delete the comment at line 62 that set the extract-on-the-third rule — it has been met.

`DismissedList`: replace its `<section>` with `<ListSection title="Tolte dalla lista" className="border-t pt-4">`.

- [ ] **Step 3: Verify**

Run: `pnpm verify`
Expected: PASS, and the rendered markup is identical.

- [ ] **Step 4: Commit**

```bash
git add components/page/list-section.tsx components/shopping "app/(app)/spesa/storico"
git commit -m "refactor: the third screen wanted the aisle section, so it became one"
```

---

### Task 15: Search, chips, and the catalogue's missing field

**Files:**

- Create: `components/page/search-field.tsx`, `components/page/filter-chips.tsx`, `lib/search-params.ts`
- Delete: `components/recipes/recipe-search.tsx`, `components/catalog/kind-filter.tsx`
- Modify: `app/(app)/recipes/page.tsx`, `app/(app)/catalogo/page.tsx`

- [ ] **Step 1: `firstOf`**

```ts
// lib/search-params.ts

/**
 * The first value of a search param.
 *
 * Next resolves a repeated `?q=` to a string array, not a string, so a param
 * has to be typed as Next actually delivers it and narrowed here.
 *
 * @param raw - what Next put in the resolved searchParams
 * @returns the first value, or undefined
 */
export function firstOf(
  raw: string | string[] | undefined
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw
}
```

- [ ] **Step 2: `SearchField`**

`components/recipes/recipe-search.tsx` moves to `components/page/search-field.tsx` with the route as a prop. Keep the 250 ms debounce, the guard against a no-op replace, `scroll: false`, and `data-pending`.

```tsx
export function SearchField({
  basePath,
  placeholder,
  label,
  param = "q",
}: {
  basePath: string
  placeholder: string
  label: string
  param?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get(param) ?? "")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const next = value.trim()
    // Landing on the page leaves `value` matching the URL already — without
    // this guard that still schedules a no-op replace, re-fetching the RSC
    // payload for nothing.
    if (next === (searchParams.get(param) ?? "")) return

    const timer = setTimeout(() => {
      // Every other param survives the search, the way the chips survive it.
      const params = new URLSearchParams(searchParams)
      if (next === "") params.delete(param)
      else params.set(param, next)
      const search = params.toString()
      startTransition(() =>
        router.replace(search === "" ? basePath : `${basePath}?${search}`, {
          scroll: false,
        })
      )
    }, 250)

    return () => clearTimeout(timer)
  }, [value, router, searchParams, basePath, param])

  return (
    <Input
      type="search"
      name={param}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      data-pending={isPending ? "" : undefined}
      className="w-full"
    />
  )
}
```

- [ ] **Step 3: `FilterChips`**

`components/catalog/kind-filter.tsx` moves to `components/page/filter-chips.tsx`, with `basePath`, `param`, `chips` and `keep`. Copy its class names verbatim — including the `rounded-4xl` and the focus ring — and keep the comment explaining why these are links and not buttons.

```tsx
export function FilterChips({
  basePath,
  param,
  chips,
  active,
  keep = {},
}: {
  basePath: string
  param: string
  chips: readonly { value: string | undefined; label: string }[]
  // The raw param, not the value it maps to: a value nobody offered should
  // highlight nothing, rather than highlight "Tutti" and imply it was understood.
  active: string | undefined
  keep?: Record<string, string | undefined>
}) { … }
```

- [ ] **Step 4: Wire both pages**

`app/(app)/recipes/page.tsx`: replace `<RecipeSearch />` with
`<SearchField basePath="/recipes" placeholder="Cerca una ricetta…" label="Cerca una ricetta" />`, keeping the `<Suspense>` around it — `useSearchParams` needs it. Replace the two-line param narrowing with `firstOf`.

`app/(app)/catalogo/page.tsx`: replace `<KindFilter … />` with `<FilterChips basePath="/catalogo" param="tipo" chips={KIND_CHIPS} active={tipo} keep={{ q }} />`, and **add above it** the search field that was missing:

```tsx
<Suspense>
  <SearchField
    basePath="/catalogo"
    placeholder="Cerca una voce…"
    label="Cerca una voce"
  />
</Suspense>
```

`KIND_CHIPS` is the old `CHIPS` constant, moved into the page:

```tsx
const KIND_CHIPS = [
  { value: undefined, label: "Tutti" },
  { value: "ingredienti", label: "Ingredienti" },
  { value: "prodotti", label: "Prodotti" },
] as const
```

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A components/page components/recipes components/catalog "app/(app)/recipes/page.tsx" "app/(app)/catalogo/page.tsx" lib/search-params.ts
git commit -m "feat: the catalogue gets the search field its query param already expected"
```

---

### Task 16: Message pages and the five error boundaries

**Files:**

- Create: `components/page/message-page.tsx`
- Modify: `components/page/page-error.tsx`, `app/not-found.tsx`, `app/(app)/not-found.tsx`, `app/(app)/recipes/[id]/not-found.tsx`, and the five `error.tsx` files

- [ ] **Step 1: `MessagePage`**

```tsx
import { cn } from "@/lib/utils"

// Not EmptyState: that renders a <p>, which is right inside a page whose <h1>
// comes from PageHeader. These screens have no PageHeader, so folding them in
// would leave three pages with no heading at all.
export function MessagePage({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <main
      className={cn(
        "flex flex-col items-center gap-4 pt-24 text-center",
        className
      )}
    >
      <h1 className="text-sm">{title}</h1>
      {children}
    </main>
  )
}
```

- [ ] **Step 2: Use it in the three not-found pages**

`app/not-found.tsx` keeps its `px-6` via `className="px-6"` — it renders outside the app shell, which supplies the horizontal padding for the other two. Keep each page's own copy and its own destination button, and keep the comments explaining why these ship with a 200.

- [ ] **Step 3: Let `PageError` be a route's default export**

```tsx
"use client"

import { Button } from "@/components/ui/button"

// `error` is accepted and ignored: Next hands it to every error boundary, and
// taking it here is what lets each route's error.tsx be a bare re-export.
export function PageError({ reset }: { error?: Error; reset: () => void }) {
```

- [ ] **Step 4: Reduce the five boundaries**

Each of the five `error.tsx` files becomes:

```tsx
"use client"

// Next requires an error boundary file to be a client component, and requires
// it per segment. There is nothing per-segment to say.
export { PageError as default } from "@/components/page/page-error"
```

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/page app "app/(app)"
git commit -m "refactor: three 404s and five error boundaries stop being copies"
```

---

### Task 17: Browser checklist C, and the documents

- [ ] **Step 1: The lists and their four states**

At 390px: `/recipes` shows the recipes; type a name that matches nothing and confirm the filtered-empty copy has no «Nuova» button; clear the field and confirm the list comes back without a page jump. Do the same on `/catalogo`, which now has a search field for the first time. Tap each of the three chips and confirm what you typed survives the tap, and that the chip and the search both appear in the URL.

- [ ] **Step 2: Grouped sections**

`/spesa` groups by aisle. Remove a generated line and confirm it appears under «Tolte dalla lista» with the same section styling. Open a purchase from `/spesa/storico` and confirm its aisle sections look identical to the shopping list's.

- [ ] **Step 3: 404 and the error boundary**

Visit `/recipes/nonexistent`, `/menu/2026-08-19` (not a Monday) and `/qualcosa`: each shows an Italian message with a way back. Break a service temporarily to trip an error boundary on one route and confirm «Qualcosa è andato storto» with a working Riprova, then undo it.

- [ ] **Step 4: Update the documents**

In `docs/conventions/ui.md`, extend the "Page primitives" table with `ListBody`/`DetailBody`, the four typed fields, `FormField`, `FormDrawer`, `ListSection`, `SearchField`, `FilterChips`, `MessagePage`, `FormMessage` and `FormActions`. Add, in prose: that a typed field defines only `label`, `description` and `error`; that everything else spreads onto the native control; that `SelectField`'s `options` is the one exception; and that reaching for `FormField` is normal rather than a failure. Note that «Svuota» is gone and why.

In `docs/roadmap.md`, add the row to "Shipped" pointing at the spec and this plan, and record that the catalogue gained its search field.

- [ ] **Step 5: Final gate**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Commit and open the pull request**

```bash
git add docs
git commit -m "docs: record the primitives, so the next module does not write them again"
git push -u origin feat/page-primitives
gh pr create --title "feat: the page primitives the form and the drawer never got" --body "…"
```
