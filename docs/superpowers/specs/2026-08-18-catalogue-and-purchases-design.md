# Catalogue, shopping list and purchase history — design

**Status:** decided, 2026-08-18.

**Scope:** extends `2026-08-13-menu-spesa-design.md`. It revises §5 (data model)
and §6.3 (shopping list) of that document and adds a screen it never described.
Everything else there still holds; where this document overrides it, the section
says so.

---

## 1. What this changes, and why

The shopping list has been used for real for four days. Seven things came back
from that use. Six are changes; one turned out not to be a defect.

| Request                                                               | Answered by |
| --------------------------------------------------------------------- | ----------- |
| Show which day of the week an item is needed for                      | §5          |
| A new ingredient typed by hand arrives capitalised, unlike the others | §4          |
| A line added by hand shows no quantity                                | §14         |
| Two lines for the same thing and unit must become one                 | §6          |
| Add through a `+` in the header, not a block at the foot              | §7          |
| Put anything on the list, not only things that exist as ingredients   | §3          |
| "Shopping done": move what is ticked into a history, with the amount  | §8, §9      |

**Missing units of measure was not a defect.** Raised, investigated, withdrawn
by the owner: the lines showing a bare number are the ones counted in pieces,
where `unit` is legitimately null. `lib/units.ts` is behaving.

Three decisions in here were argued and settled in conversation, and are not to
be relitigated:

- **The catalogue grows a kind rather than a sibling table** (§3). One table,
  one aisle column, one form.
- **Duplicate lines are merged when the list is read, not when it is written**
  (§6). The database keeps them apart; regeneration therefore does not have to
  know the rule exists.
- **What has already been bought is subtracted from what the menu asks for**
  (§10). Regenerating after a shop must not put the tomatoes back.

---

## 2. Overview of the data model change

```
CatalogItem  (was Ingredient)     +kind
ShoppingListItem                  +days
Purchase                          new
PurchaseItem                      new
```

Nothing else in the schema moves.

---

## 3. The catalogue holds more than ingredients

Shampoo, bin bags and a watermelon bought on impulse belong on a shopping list
and in no recipe. They still want an aisle, a default unit and a name that is
typed once, which is exactly what the catalogue already provides — so they go in
it, and the model stops claiming to be about ingredients.

```prisma
enum CatalogItemKind {
  INGREDIENT
  PRODUCT
}

model CatalogItem {
  name        String             @id
  kind        CatalogItemKind    @default(INGREDIENT)
  defaultUnit String?
  aisle       String             @default("altro")
  usedIn      RecipeIngredient[]
}
```

`RecipeIngredient.ingredientName` becomes `itemName`, its relation field
`ingredient` becomes `item`. `kind` earns its place in one place only: the
ingredient picker inside the recipe form lists `INGREDIENT` and nothing else, so
shampoo can never end up in a recipe.

### The migration is written by hand

`prisma migrate dev` generates a `DROP TABLE` and a `CREATE TABLE` for a
renamed model. That would take the 108 catalogue rows and the recipe lines that
point at them. The migration is therefore created with
`prisma migrate dev --create-only` and its SQL replaced with renames, which
Postgres performs atomically and which carry the foreign key with them:

```sql
ALTER TABLE "Ingredient" RENAME TO "CatalogItem";
ALTER INDEX "Ingredient_pkey" RENAME TO "CatalogItem_pkey";

ALTER TABLE "RecipeIngredient" RENAME COLUMN "ingredientName" TO "itemName";
ALTER TABLE "RecipeIngredient"
  RENAME CONSTRAINT "RecipeIngredient_ingredientName_fkey" TO "RecipeIngredient_itemName_fkey";
ALTER INDEX "RecipeIngredient_ingredientName_idx" RENAME TO "RecipeIngredient_itemName_idx";

CREATE TYPE "CatalogItemKind" AS ENUM ('INGREDIENT', 'PRODUCT');
ALTER TABLE "CatalogItem"
  ADD COLUMN "kind" "CatalogItemKind" NOT NULL DEFAULT 'INGREDIENT';
```

The constraint and index renames are not cosmetic: leaving them named after the
old column is what makes a later `prisma migrate dev` believe the schema has
drifted. The plan verifies by running `prisma migrate dev` again afterwards and
seeing it generate nothing.

The following are renamed with the model, because a file called
`ingredients.ts` that exports a catalogue of shampoo is a lie:

| From                          | To                        |
| ----------------------------- | ------------------------- |
| `lib/services/ingredients.ts` | `lib/services/catalog.ts` |
| `lib/schemas/ingredient.ts`   | `lib/schemas/catalog.ts`  |
| `prisma/ingredients.ts`       | `prisma/catalog.ts`       |

`lib/services/ingredient-parse.ts` and `lib/services/ingredient-name.ts` keep
their names. They are still about parsing an ingredient line out of prose for
the URL import of the original spec §6.1, and they have nothing to do with the
catalogue's identity.

---

## 4. Names are normalised where they are validated

A name typed into the app arrives as the user shifted it — `Pomodori` — and
sorts and compares as a different thing from the ninety-two lowercase names the
seed put there. Two consequences: the catalogue looks inconsistent, and the
merge rule of §6 silently fails to merge.

The name is therefore lowercased, with internal whitespace collapsed, **inside
the Zod schema**: `CatalogItemNameSchema` and the name field of
`ManualItemSchema`. One place, so it applies to the catalogue form, the recipe
form and the shopping drawer at once, and so no route handler can forget it.

The 108 existing rows are already lowercase. There is nothing to backfill.

**This is not `normaliseIngredientName`.** That function additionally strips
leading articles, which is right when matching scraped prose against the
catalogue and wrong as a rule for what a user may name a thing. Do not wire the
two together.

Display follows storage: lowercase everywhere, as it already is.

---

## 5. The day an item is needed for

`ShoppingListItem` grows `days Int[]` — the day indices, 0 to 6, of the slots
that contributed the line. A line added by hand has an empty array.

The aggregator is what fills it. `AggregatorSlot` grows a `day`, which the
service already has in hand: it reads `menu.slots`, and every slot carries one.

The row renders `nome · 200 g · lun, mer`. Days take the same typographic
treatment as the quantity — `text-xs text-muted-foreground` — because they
answer the same kind of question. Above three days the list truncates:
`lun, mer +2`.

The abbreviations are `Intl.DateTimeFormat("it-IT", { weekday: "short" })` in
`APP_TIMEZONE`, which is what `/menu/[weekStart]` already builds inline for its
column headings. Two screens wanting the same seven strings is one too many, so
that becomes `dayLabels(weekStart)` in `lib/week.ts` and both call it. It is the
only refactor this design asks for that was not requested.

---

## 6. Duplicate lines merge when the list is read

Adding 200 g of tomatoes by hand when the menu already asks for 300 g must
produce one line reading 500 g. The obvious implementation — sum into the
existing row — loses the 200 g at the next regeneration, which rebuilds every
generated row from the menu.

So the rows stay apart in the database, and the merge happens in the read path.
Regeneration keeps working exactly as it does today: it deletes the generated
rows, rebuilds them, and leaves the manual ones alone. It needs to know nothing
about merging.

A new pure function, `mergeLines`, lives in **`lib/services/shopping-view.ts`**,
a new module, together with `groupByAisle`, which moves there from
`shopping-lists.ts`. That file is already three hundred lines and is doing two
jobs: talking to the database, and shaping a list for a screen. This splits
them.

```ts
type MergedLine = {
  key: string // (name, unit) — stable across renders, so it keys the <li>
  ids: string[] // every row behind this line
  manualIds: string[] // the subset added by hand
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  days: number[]
  checked: boolean
}
```

Lines merge on the pair `(name, unit)`. `""` is already normalised to `null`
upstream, so a blank unit cannot open a second line.

The rules, which are the part that can be got wrong:

| Field      | Rule                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `quantity` | sum of the non-null quantities; `null` only when every component is null                                         |
| `checked`  | true only when **every** component is ticked. Ticking the line ticks them all; unticking unticks them all        |
| `days`     | union, ascending                                                                                                 |
| `aisle`    | the first component's, in walking order — components with the same name are in the same aisle in every real case |
| bin icon   | shown when `manualIds` is non-empty, and it deletes **only** those rows                                          |

The consequence of the last rule is deliberate: deleting the hand-added 200 g
leaves the line at the 300 g the menu asks for, rather than removing something
the menu still needs.

Because a line now stands for several rows, `toggle` and `removeItem` take a
list of ids rather than one. The form posts one `id` field per row and the
action reads `formData.getAll("id")`.

---

## 7. Adding a line

The block at the foot of the page becomes a `+` in the header, opening a
`Drawer` — the same component and the same shape as the menu's slot drawer, so
the two screens feel like one app.

| Field           | Notes                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Che cosa serve  | combobox over the catalogue; free text that matches nothing is accepted    |
| Quantità        | number, optional                                                           |
| Unità           | text, pre-filled from the catalogue entry's `defaultUnit`                  |
| Reparto         | select over `AISLE_ORDER`, pre-filled from the catalogue entry             |
| **Tipo**        | Ingrediente / Prodotto — **only when the name is new**, default _Prodotto_ |
| **Non salvare** | checkbox, unticked — **only when the name is new**                         |

A name already in the catalogue shows neither of the last two: there is nothing
to decide.

**Why `Prodotto` is the default.** What gets cooked with is normally created
from the recipe form, where the kind is `INGREDIENT` by construction. What gets
typed into the shopping drawer is normally the other thing. The default is
wrong sometimes, one select fixes it, and getting it wrong costs only an entry
in the wrong filter tab.

**Why saving is the default.** The point of the request was that shampoo should
not have to be re-typed with its aisle re-chosen every week. The escape hatch is
for genuinely one-off things, so it is opt-out and phrased as one:
_Non salvare nel catalogo_.

Creating the catalogue entry and adding the shopping line is one transaction. A
line on a list pointing at an entry that failed to be created is the kind of
half-write that is discovered a week later.

---

## 8. Completing a shop

A fixed bar at the foot appears as soon as one line is ticked, reading
`Spesa completata (7)`. It respects `env(safe-area-inset-bottom)`, without which
it sits under the home indicator on an installed PWA.

It is at the foot and not in the header for two reasons: the header would then
carry three controls at 390px, and this is the action taken at the till, with a
thumb.

Tapping it opens a drawer asking for the amount paid, with **Salta** alongside
**Conferma** — the amount is optional and editable later (§9).

```prisma
model Purchase {
  id          String         @id @default(cuid())
  listId      String
  list        ShoppingList   @relation(fields: [listId], references: [id], onDelete: Cascade)
  purchasedAt DateTime       @default(now())
  totalCents  Int?
  items       PurchaseItem[]

  @@index([listId])
}

model PurchaseItem {
  id         String   @id @default(cuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  name       String
  quantity   Float?
  unit       String?
  aisle      String

  @@index([purchaseId])
}
```

Three things in that worth stating.

**`totalCents Int?`, not `Decimal`.** A Prisma `Decimal` is not serialisable
across the server-to-client component boundary, so every read would need a
conversion by hand at the call site — and forgetting one is a runtime error in
production, not a type error. Integer cents have neither that problem nor
floating-point rounding. The input accepts `12,34` and `12.34` alike via an
`EuroAmountSchema` in `lib/schemas/shopping.ts` that transforms to cents; the
Italian keyboard produces a comma.

**Lines are copied, not referenced.** The shopping row is deleted when the shop
closes, and in any case a history must say what was bought then, not what the
catalogue says now.

**A `Purchase` hangs off the `ShoppingList`, not off the week.** That is what
makes §10 a single query. The week is read back through `list.menu.weekStart`.

Closing a shop is one transaction: create the `Purchase`, copy the ticked rows
into `PurchaseItem`, delete those rows from the list. The bar does not exist
when nothing is ticked, so there is no empty-purchase case to handle.

Multiple shops per week are the expected case, not an edge one.

---

## 9. The history screen

`/spesa/storico`, reached from a new nav entry **Storico spesa**. It lists every
purchase across every week, newest first: date, the week it belonged to, the
number of items, and the total — or a visible _totale da inserire_ where there
is none.

`/spesa/storico/[id]` shows one purchase: its lines grouped by aisle, and the
total as an editable field.

Next.js prefers a static segment to a dynamic sibling, so `spesa/storico` wins
over `spesa/[weekStart]` without anything having to be configured. It would
answer `notFound()` even if it did not, since `WeekStartSchema` rejects it.

---

## 10. What regeneration does now

You buy 300 g of tomatoes on Monday. On Wednesday the menu changes and you press
**Rigenera**. Without a rule, the tomatoes come back.

`aggregateShoppingList` therefore takes a third input: what has already been
bought on this list, as `{ name, unit, quantity }` rows read straight from
`PurchaseItem`. For each generated line it subtracts the purchases matching the
same `(name, unit)` pair:

- required 300, bought 300 → the line does not appear
- required 500, bought 300 → the line appears at 200
- required unquantified, anything bought → the line does not appear
- bought with no quantity → the line is treated as satisfied and does not appear

The subtraction happens after rounding, so a countable line cannot come back as
0.4 of something.

This is the same idea the aggregator already implements for ticks — a tick that
stops being true when the quantity rises — extended from "I have enough" to "I
have bought some". Manual purchases are subtracted too: if you bought tomatoes,
you have tomatoes, whichever line put them on the list.

---

## 11. The screens, and the catalogue's new home

`/ingredients` becomes `/catalogo`; the nav entry **Ingredienti** becomes
**Catalogo**. One list holds both kinds, with three chips at the top — Tutti /
Ingredienti / Prodotti — driven by a search param so the page stays a server
component. `Tipo` becomes a field of the catalogue form, next to the aisle.

Sub-segments stay English (`/catalogo/new`, `/catalogo/[name]/edit`), which is
the existing pattern: `/spesa/[weekStart]` already mixes an Italian route with
an English parameter.

Final nav order:

```
Menù · Spesa · Storico spesa · Ricettario · Catalogo
```

---

## 12. Layering

Nothing here bends the rules in `CLAUDE.md`. Everything that decides anything is
a function in `lib/services/`:

| Module                               | Holds                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| `lib/services/shopping-aggregate.ts` | days, and the subtraction of §10 — still pure, still no db |
| `lib/services/shopping-view.ts`      | `mergeLines` and `groupByAisle` — new, pure                |
| `lib/services/shopping-lists.ts`     | the reads and writes, minus what moved out                 |
| `lib/services/purchases.ts`          | closing a shop, reading the history, editing a total — new |
| `lib/services/catalog.ts`            | the catalogue, renamed, with the `kind` filter             |

Server actions stay thin: validate with Zod, `requireSession()`, call a service,
`revalidatePath`. Every new action does all four, in that order.

---

## 13. Testing

What is costly to get wrong is pure and gets a test. What is Prisma, shadcn or a
screen does not — `docs/conventions/testing.md`.

- `shopping-aggregate.test.ts`: `days` collected from the right slots; the four
  subtraction cases of §10; a purchase that does not match any generated line
  changing nothing.
- `shopping-view.test.ts`, new: every rule in the table of §6, plus the case
  that motivated it — a manual line and a generated line becoming one, and the
  bin removing only the manual half.
- `catalog.test.ts` (was `ingredients.test.ts`): the `kind` filter.
- The schema tests: lowercasing, and `EuroAmountSchema` — `12,34` and `12.34`
  both give 1234, `12` gives 1200, `0` is accepted, `-1` and `12,345` are
  refused. A free shop is a real thing; a negative one is not, and three
  decimals means a typo rather than a price.

UI is checked with a written manual checklist at 390px, per the standing
decision. Each plan ends with one.

---

## 14. One defect not yet explained

"A line added by hand shows no quantity" is real and reported, and reading the
code does not account for it: the form sends `quantity`, `ManualItemSchema`
accepts it, `addManualItem` writes it, and the row renders it through the same
`amountOf` as every other line.

Plan B replaces that form with the drawer of §7. It **reproduces the defect in a
browser first**, and only then rewrites — otherwise the rewrite either carries
the cause forward or hides it, and neither is knowing.

---

## 15. Deliberately not in scope

| Excluded                            | Reason                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Deleting or undoing a purchase      | Not requested. A wrong close is recoverable only by editing the database. Worth adding the moment it happens once; not before |
| The shop, and a note, on a purchase | Offered and declined. Two columns to add later if the history turns out to be worth slicing that way                          |
| Per-item prices                     | The request was "how much did I pay", singular. Per-item prices are a receipt scanner wearing a data model                    |
| Spend charts                        | The history is the data those would need. Build it, use it for a month, then decide what is worth plotting                    |
| Deleting a `CatalogItem` in use     | Unchanged: `onDelete: Restrict` still refuses, and that is right                                                              |

---

## 16. Sequence

Three plans, one design. Each is cut from `main` on its own branch, and each
leaves the app working.

| #   | Plan                    | Contents                                                                       |
| --- | ----------------------- | ------------------------------------------------------------------------------ |
| A   | Catalogue               | the rename of §3, `kind`, `/catalogo` with its filter, the normalisation of §4 |
| B   | The shopping list again | days (§5), the merge (§6), the drawer (§7), free items, and the defect of §14  |
| C   | Shopping done           | `Purchase` and `PurchaseItem` (§8), the subtraction (§10), the history (§9)    |

A first because everything else names `CatalogItem`. B before C because C
deletes rows that B teaches the list to merge.
