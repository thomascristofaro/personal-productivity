# Finance — Design Document

**Date:** 2026-08-23
**Status:** Design approved, pending implementation plans
**Scope:** the second module of the app — accounts, imported movements,
categories, transfers between accounts, and the summary that reads them; plus
the home screen that now has to choose between two modules
**Parent:** [`2026-08-13-menu-spesa-design.md`](2026-08-13-menu-spesa-design.md)
names personal finance as a planned module sharing the shell, the database and
the deployment. This document is that module. It does not amend the parent — the
menu and shopping module is untouched except for the shell changes in §2.

---

## 1. Purpose

The owner holds money in three places — Satispay, Revolut and Intesa Sanpaolo —
and therefore checks three apps to answer one question. This module is the single
place where the three histories meet.

It answers two questions, and only two:

1. **Where did the money go?** Income, outgoings and the split of outgoings by
   category, for a month.
2. **How much can I still spend?** Not against a ceiling — against how this month
   compares to the last three.

Neither can be answered without a category on every movement. That is the real
cost of the module: the import is mechanical, the categorising is not. Every
decision below is made to drive the number of movements the owner has to touch by
hand towards zero over the first few months.

### Success criterion

At the end of a month, importing three files and reaching a fully categorised
history takes minutes, not an evening — and the second month takes less than the
first, because the rules written in the first still hold.

### The one defect that must not exist

A real outgoing silently disappearing. Every design decision that trades
simplicity against this — the duplicate counting in §5.3 above all — resolves in
favour of not losing the movement.

---

## 2. What changes in the shell

### 2.1 The home becomes a fork

`app/page.tsx` today is `redirect("/menu")` and sits **outside** the `(app)`
route group, so it never renders inside the shell. The fork needs the shell.

- Delete `app/page.tsx`.
- Add `app/(app)/page.tsx`. Same URL, now inside the layout that carries the nav.

It shows two blocks, each a large tappable card with a title and one line of
subtitle: **«Menù e spesa»** → `/menu`, **«Finanza»** → `/finance`.

The Finanza block is rendered only when the signed-in user can see at least one
account (§3). A door onto an empty room is worse than no door.

No new component in `components/page/` for this. Two cards on one screen is not a
primitive; it becomes one if a third module ever needs the same shape.

### 2.2 The navigation gains groups

`components/app-nav.tsx` holds a flat `NAV_ITEMS` of four entries. It becomes two
named groups plus the owner's entry:

| Group          | Entries                                       |
| -------------- | --------------------------------------------- |
| Menù e spesa   | Menù, Spesa, Ricettario, Catalogo             |
| Finanza        | Riepilogo, Movimenti, Importa                 |

Seven entries, not nine: **accounts and rules deliberately have no nav entry.**
They are reached from the summary and from the movement they concern, which is
where someone actually looks for them.

The Finanza group is omitted entirely when the user sees no accounts, matching
the block on the home.

**A contextual nav was considered and rejected for now.** One menu with two
groups holds no state and always shows where you could go; the contextual
version reads better on a phone but introduces a "where am I" the menu does not
have today. If seven entries prove crowded in use, the change is one file in
either direction — this is recorded so the option is not lost.

`activeHref` already picks the longest matching href, so `/finance` and
`/finance/movements` will not both light up. No change needed there.

---

## 3. Who sees what

Accounts are owned. This is the module's only authorisation rule, and it is not
optional: the two users are a couple, not a company, but an account statement is
still the most personal data in this database.

- A `FinanceAccount` has an **owner**, and may be flagged **shared**.
- A user sees an account when they own it, or when it is shared.
- A user sees a movement when they see its account. There is no other path.

**One function decides this**, in `lib/services/finance/access.ts`:

```
visibleAccountIds(actorId: string): Promise<string[]>
```

Every read and every write in the module starts from it. It is not a check
scattered across pages: a forgotten check is exactly the IDOR that `CLAUDE.md`
warns about under the `actorId` rule, and `actorId` here means what it always
means — an identity the caller already verified from the session, never a value
from a payload.

Consequences that follow and must not be worked around:

- A service function that touches movements takes `actorId` and filters by
  visible accounts **inside the query**, not after it.
- Requesting a movement on an invisible account is `notFound()`, not
  «non autorizzato». Telling someone a row exists is already telling them
  something.
- `requireOwner()` is **not** used here. It gates `/settings/llm` for a different
  reason; finance is gated by ownership of the account, and the partner is a
  first-class user of her own accounts.

---

## 4. The data model

Six tables. Names in English, values in Italian, as everywhere else.

### 4.1 `FinanceAccount`

A place money sits.

| Field              | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `name`             | as the owner calls it — «Revolut», «Conto Intesa»                |
| `provider`         | `SATISPAY` \| `REVOLUT` \| `INTESA`, and it selects the reader   |
| `ownerId`          | the user it belongs to                                           |
| `shared`           | when true, both users see it                                     |
| `openingBalanceCents` | the balance on `openingBalanceAt`, in integer cents           |
| `openingBalanceAt` | the date that balance was true, `@db.Date`                       |

**The name carries the module prefix because `Account` is already taken** by
better-auth's core schema. That is a collision, not a stylistic choice.

`provider` is an enum and not free text: it decides which reader parses an
uploaded file, so an unknown value has no behaviour.

### 4.2 `Movement`

One line of a statement. Never edited after import — see §9.3.

| Field              | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `accountId`        |                                                                         |
| `date`             | `@db.Date`, the same date-only convention as `Menu.weekStart`            |
| `amountCents`      | integer cents, **negative for an outgoing**. One column, not two         |
| `description`      | as the file wrote it, normalised only for whitespace                     |
| `providerCategory` | the category the file declared, verbatim, or null                        |
| `providerRef`      | the provider's own transaction id when the file carries one, else null   |
| `fingerprint`      | see §5.3                                                                |
| `occurrence`       | see §5.3                                                                |
| `categoryId`       | nullable — null means «Da categorizzare»                                 |
| `categorySource`   | `MANUAL` \| `RULE` \| `PROVIDER_MAP` \| `TRANSFER_LINK` \| `NONE`        |
| `note`             | the owner's own text, nullable                                          |
| `importBatchId`    | which import wrote it                                                   |

Integer cents rather than `Decimal`, for the reason already recorded on
`Purchase.totalCents`: a Prisma `Decimal` does not survive the server-to-client
component boundary, so every read would need a conversion by hand and a forgotten
one is a runtime error instead of a type error. `lib/money.ts` already formats
cents; it is reused, not reimplemented.

`categorySource` exists to protect manual work. Without it, the first «apply this
rule to past movements too» overwrites an afternoon of decisions and nobody
notices until the summary is wrong.

Indexes: `[accountId, date]` for the list, `[categoryId]` for the summary, and
the uniqueness constraint of §5.3.

### 4.3 `Category`

| Field       | Meaning                                     |
| ----------- | ------------------------------------------- |
| `name`      | Italian, because it is data — «Ristoranti»  |
| `kind`      | `EXPENSE` \| `INCOME` \| `TRANSFER`         |
| `sortOrder` | the order the owner thinks in               |
| `archived`  | hidden from pickers, kept on old movements  |

**Exactly one category has `kind = TRANSFER`**, seeded as «Trasferimento». It is
an ordinary category in every list and picker; the only thing that treats it
specially is the summary, which excludes it from income and outgoings. That
exclusion is written in one place — §8.2 — and nowhere else.

Archived rather than deleted: deleting a category would either orphan or
recategorise history, and both rewrite the past.

### 4.4 `CategoryRule`

| Field        | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `kind`       | `DESCRIPTION_CONTAINS` \| `PROVIDER_CATEGORY_IS`                      |
| `pattern`    | the substring, or the provider's category verbatim                    |
| `categoryId` | what it assigns                                                       |
| `priority`   | lower runs first; **the first match wins and matching stops**         |
| `accountId`  | nullable — null means every account                                   |

Matching is case-insensitive and whitespace-tolerant. It is a substring test, not
a regular expression: a regex in this field is a foot-gun the owner would have to
debug from a phone.

Ordered, first-match-wins, because a specific rule written today has to beat a
general rule written in March without anyone rewriting the general one.

### 4.5 `TransferLink`

| Field             | Meaning                            |
| ----------------- | ---------------------------------- |
| `fromMovementId`  | `@unique`                          |
| `toMovementId`    | `@unique`                          |
| `confirmedAt`     |                                    |

A row per pair, not a column on each movement. Both sides unique, so a movement
can belong to at most one link, and unlinking is deleting one row — which frees
both legs at once and cannot leave a half-broken pair behind.

### 4.6 `ImportBatch`

| Field                     | Meaning                                     |
| ------------------------- | ------------------------------------------- |
| `accountId`, `userId`     | what was loaded, and by whom                |
| `fileName`                | for the history, not for parsing            |
| `rowsRead`, `rowsWritten`, `rowsSkipped` | what the preview promised    |
| `periodFrom`, `periodTo`  | the range the file covered                  |

It answers «from when is this account covered». It is **not** an undo: undoing an
import was considered and left out, because the duplicate counting of §5.3 makes
a repeated import harmless and the balance check of §8.1 catches a wrong file.

### 4.7 Deliberate absences

Recorded so nobody adds them as an oversight:

- **No stored balance.** The balance is derived — §8.1. A stored one diverges.
- **No archive of uploaded files.** A file is read, its rows are written, it is
  discarded. Nothing here is a document store.
- **No currency column.** §5.5.
- **No link to `Purchase`.** §11.

---

## 5. Importing

### 5.1 The flow

1. The user picks an account and uploads a file at `/finance/import`.
2. The reader for that account's `provider` parses it into `ParsedMovement[]`.
3. The service compares against what is stored and computes what is new.
4. **A preview is shown before anything is written**: account, period covered,
   *«42 nuovi, 18 già presenti, 1 riga illeggibile»*.
5. The user confirms. Only then are rows written, inside one transaction, with an
   `ImportBatch`.
6. The rules of §6 run over the new rows.
7. The pairing of §7 runs — over the whole account, not only the new rows.
8. The result says how many are left to categorise and how many pairs await
   confirmation, each a link.

### 5.2 The readers

One reader per provider, hand-written, in `lib/services/finance/parsers/`:
`satispay.ts`, `revolut.ts`, `intesa.ts`. Each knows its own format and returns
the same shape:

```
type ParsedMovement = {
  date: Date            // @db.Date convention: UTC midnight
  amountCents: number   // negative for an outgoing
  description: string
  providerCategory: string | null
  providerRef: string | null
}
```

They are pure: no React, no `next/*`, no `Request`, no database. They take the
file's text and return values, which makes them the most testable thing in the
module — the same shape as `aggregateShoppingList`, which is the most tested
thing in the repository.

A generic column-mapping importer, configurable from the app, was considered and
rejected: three accounts are known, and the generality would be paid for now
against a problem already solved by exporting a file.

**A reader that does not recognise its file stops.** If the expected columns are
absent it throws, the import writes nothing, and the screen says the file does
not look like an export from that provider. A half-imported file is worse than a
failed import, so partial writes are not a mode this module has.

### 5.3 Recognising duplicates without losing a movement

Exports overlap by period; the same file may be loaded twice. Duplicates must be
skipped. The naive way loses money.

The identity of a movement is:

```
fingerprint = hash(accountId, date, amountCents, normalised description, providerRef)
```

Two coffees of €1,50 at the same bar on the same day produce **the same
fingerprint**, and skipping the second deletes a real outgoing in silence. So the
comparison is not row-against-row, it is a **count**:

> For each distinct fingerprint in the file, count the rows the file carries (M)
> and the rows already stored (N). Write `max(0, M − N)` of them, numbered from
> N upwards in `occurrence`.

`@@unique([accountId, fingerprint, occurrence])` enforces this in Postgres, so
two concurrent imports cannot both decide they are the first.

When the file carries a `providerRef` — Revolut does — it enters the fingerprint
and makes it unique on its own; `occurrence` is then always 0 and the counting
never engages. That is the good case, and the counting is what covers the others.

### 5.4 Dates

`@db.Date`, produced through the app's timezone the way `lib/week.ts` already
does it. A statement row has a calendar date, not an instant; storing it as an
instant would make a purchase at 23:40 land on the previous day for half the year.

### 5.5 Currency

Everything is euro cents. The household has no non-euro account; a card payment
made abroad still debits the euro account in euro, and that debited amount is
what a statement shows and what this module stores.

If a file declares an original currency, it is appended to `description` as text
to read — never as a number to add. There is no currency column and no conversion
anywhere in the module.

The one consequence: an internal exchange between two Revolut pockets in
different currencies will not pair automatically, because the two amounts differ.
It is linked by hand, twice a year. Accepted.

---

## 6. Categorising

### 6.1 Three sieves, in order

Every movement written by an import passes:

1. **`DESCRIPTION_CONTAINS` rules**, by priority, first match wins.
   `categorySource = RULE`.
2. **`PROVIDER_CATEGORY_IS` rules** — the map from what the file declared to what
   we call it: *Revolut says `Groceries` → «Spesa»*.
   `categorySource = PROVIDER_MAP`.
3. **Nothing.** `categoryId = null`, `categorySource = NONE`, and it appears
   under the «Da categorizzare» filter.

Description rules run first because the owner wrote them looking at a real case,
and a specific fact beats a general one. The provider's own category is good
enough to cover most of the volume for free, which is why it is a sieve and not
an afterthought — the files already carry categories, they are simply incomplete
and inconsistent between the three providers.

**No LLM.** Not deferred: decided. Rules are deterministic and reviewable, and
the same shop must never land in two categories in two months, which is exactly
what would make the summary untrustworthy.

### 6.2 The one-tap rule

From an uncategorised movement, choosing a category also offers the rule:
*«la descrizione contiene ESSELUNGA → Spesa»*, with the token already extracted
from the description and editable before saving.

On saving, the app asks whether to apply it backwards.

### 6.3 Applying a rule backwards

Applying backwards touches **only movements whose `categorySource` is not
`MANUAL`** — and never one that belongs to a `TransferLink`. A rule can improve
a guess; it cannot overrule a decision.

Rules never re-run by themselves over stored movements. They run on import, and
when the owner asks. An automatic re-run would make the history change under
someone who did not change anything.

---

## 7. Transfers

### 7.1 What pairing looks for

After every import, and on request, the service looks for candidate pairs:

- equal amounts with opposite signs,
- on **different** accounts,
- within a window of days — **4** by default, in `lib/config.ts`,
- neither side already in a `TransferLink`.

Candidates are presented as «Trasferimenti da confermare» and accepted in bulk or
one at a time. **Nothing is linked without confirmation.** A false positive hides
a real expense, and it would be found months later.

If a movement has more than one plausible partner, the service does not choose:
it shows them side by side and the owner picks.

### 7.2 Confirming, and what it does

Confirming writes the `TransferLink` and sets **both** movements to the
`TRANSFER` category with `categorySource = TRANSFER_LINK`. That way the summary
has one rule to obey and not two.

Unlinking deletes the row and re-runs the rules of §6 over the two movements,
which leaves them either recategorised or back under «Da categorizzare».
Predictable, and it never leaves a stale «Trasferimento» on a movement that is no
longer one.

### 7.3 Pairing is not limited to the batch

The search runs over the whole account each time. Revolut is exported today,
Intesa next week, and the pair forms next week. Restricting it to the rows just
written would silently miss every pair that straddles two imports — which is most
of them.

### 7.4 A transfer without a twin

A movement can be given the `TRANSFER` category by hand, or by a rule, with no
link. Cash withdrawals are the reason: the money leaves towards something this
module does not track, and it is not an expense at the moment it leaves.

---

## 8. What the numbers mean

### 8.1 Balance

```
balance(account) = openingBalanceCents
                 + Σ amountCents of its movements with date >= openingBalanceAt
```

Derived at read time, never stored, so it cannot drift on its own.

**Movements before `openingBalanceAt` are excluded from the sum** — the opening
balance already contains them. They are still imported and still visible in the
list; they simply do not count twice.

**Transfers are included in the balance.** They are excluded from income and
outgoings because they are neither, but the money genuinely moved: a €200 top-up
does raise the Revolut balance. This is the distinction that gets confused first,
so it is stated twice on purpose.

The balance earns its place by being a check: when the computed figure disagrees
with what the provider's app shows, an import has a hole. Coverage dates say how
far you got; only the balance says whether something is missing in the middle.

### 8.2 Income and outgoings

For a month, over the visible accounts:

- **outgoings** = Σ of negative `amountCents` where the category's `kind` is not
  `TRANSFER`
- **income** = Σ of positive `amountCents` where the category's `kind` is not
  `TRANSFER`
- uncategorised movements **count** towards income and outgoings — they are real
  money — and are reported separately as work still to do

A movement with no category has no `kind`, so the exclusion is written as «the
category is absent, or its kind is not `TRANSFER`». Getting this backwards would
drop every uncategorised movement from the totals, which is the §1 defect wearing
a different hat.

One consequence follows and is expected: **an unconfirmed transfer inflates both
income and outgoings** until its pair is confirmed, because until then it is two
uncategorised movements. This is why the count of pairs awaiting confirmation is
a call to action at the top of the summary and not a detail — the numbers below
it are not yet true.

The `TRANSFER` exclusion appears in exactly one function. Every screen that shows
a total calls it.

### 8.3 The comparison that replaces a budget

Per category, for the chosen month: the amount spent, and the **mean of the same
category over the previous three months**, ignoring months with no data at all.
*«Ristoranti 180 €, di solito 110»*.

This answers «how much can I still spend» without a single ceiling to invent
before knowing what the baseline is. Ceilings remain a possible later project,
and when they come the app can propose them from these same means.

---

## 9. The screens

### 9.1 Summary — `/finance`

Top to bottom:

1. **Calls to action, when there are any**: *31 movimenti da categorizzare*,
   *3 trasferimenti da confermare*. Both links. Absent when zero — a zero badge
   is noise.
2. **Balances**: one tile per visible account, plus the total.
3. **The month**: income, outgoings, the difference. The month is navigable
   backwards.
4. **Outgoings by category** for that month, each row with the comparison of
   §8.3.

No chart beyond that breakdown.

### 9.2 Movements — `/finance/movements`

The whole history, newest first. **Not bound to a month** — the month is the
summary's unit. Bounding the list to a month would make «when did I pay for that»
require guessing the month first.

Built from the existing primitives:

- `SearchField` over the description. It preserves the other search params while
  typing, so it composes with the filters without special handling.
- **One `FilterChips` for category**, whose chips are `Tutti`,
  `Da categorizzare`, `Trasferimenti`, then the categories. Uncategorised and
  transfers are values of this filter, not filters of their own.
- A second `FilterChips` for the account: `Tutti`, then the visible accounts.
- `DataList` / `DataListRow`, flat: description as the title, and beneath it the
  date, the account and the category; the amount on the row.

**`FilterChips` needs one change, made in place.** Its `<ul className="flex
gap-2">` does not wrap, so beyond about four chips it overflows a 390 px screen.
The row becomes horizontally scrollable. It is edited where it lives, not copied
— `components/ui` and `components/page` are our source, per `CLAUDE.md`.

**Paging**: 50 at a time with «Mostra altri», the offset in the URL like every
other piece of list state. Three accounts produce roughly two thousand movements
a year; loading them all on every filter change is a page that drags.

### 9.3 Detail — `/finance/movements/[id]`

Two halves.

**What the provider said**, read-only: date, description, amount, its own
category verbatim, the account.

**What you decided**: category, transfer link, note.

Three actions: change the category, create a rule from this movement, link or
unlink the twin.

**The imported data is never editable.** Correcting a description here would make
the next import of that period see an unrecognised row and write it again beside
the corrected one. The `note` field is where a human correction goes.

### 9.4 Accounts — `/finance/accounts`

Name, provider, owner, shared or not, opening balance and its date, computed
balance, and the date of the most recent imported movement. Create and edit. Not
in the nav; reached from the balance tiles on the summary.

### 9.5 Rules — `/finance/rules`

The ordered list, with reordering, and edit and delete. Not in the nav; reached
from the movement that made you want one, and from the summary.

### 9.6 Import — `/finance/import`

Account picker, file field, then the preview of §5.1 step 4, then confirmation,
then the outcome with its two links. Below, the recent `ImportBatch` rows so
«have I already loaded July» has an answer.

**`/import` already exists and belongs to the recipe import.** The finance one is
`/finance/import`, and there is no shortcut at the root.

---

## 10. Testing

Following `docs/conventions/testing.md` — test what is costly to get wrong.

**Tested:**

- Each reader, against fixtures taken from **real exports** of the three
  providers, including a file with a header, an empty file, and a file from the
  wrong provider.
- The duplicate counting of §5.3, with the two-identical-coffees case as a named
  test. This is the defect of §1; it gets its own test, not a branch of another.
- Rule matching: order, first-match-wins, case, account-scoped versus global.
- Applying backwards: a `MANUAL` movement is not touched. Also a named test.
- Pairing: the window, opposite signs, different accounts, an already-linked
  movement excluded, and the two-candidates case producing no automatic choice.
- The summary: transfers excluded from income and outgoings, transfers **included**
  in the balance, movements before `openingBalanceAt` excluded from the balance,
  and the three-month mean with a missing month.
- `visibleAccountIds` and one service call per screen proving an invisible
  account is unreachable.

**Not tested:** shadcn internals, Prisma itself, the shape of the summary screen.

**No end-to-end browser tests** — the standing decision holds. Each plan ends
with a written, ordered manual checklist, which an agent may drive through the
`playwright` MCP server.

---

## 11. Out of scope

Each of these was raised and left out on purpose. Do not add one as an oversight.

| Not building                       | Why                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| LLM categorisation                 | Decided against in §6.1. Rules are deterministic; the summary depends on that            |
| Spending ceilings                  | §8.3 answers the question without them, and a ceiling invented before the baseline is ignored by the second month |
| Movements created by hand          | Cash is categorised at the withdrawal, not tracked euro by euro                          |
| Declared recurring expenses        | Nothing needs them until ceilings exist                                                  |
| Attachments, receipts, file archive | Not a document store                                                                    |
| Undoing an import                  | §4.6                                                                                     |
| Any link to `Purchase`             | The supermarket payment arrives from the account like any other and gets «Spesa» from a rule. Generating a movement from a `Purchase` would double the grocery movements and make finance depend on the menu module — the coupling the layering exists to prevent |
| Bank APIs, PSD2, open banking      | Not available for these accounts on an individual basis; the file export is the interface |
| Multi-currency arithmetic          | §5.5                                                                                     |

---

## 12. Delivery

Three plans, three branches, cut from `main` and deleted on merge. Each leaves
the app working.

### Plan 1 — The fork

`app/(app)/page.tsx`, the deletion of `app/page.tsx`, and the grouped nav. Small,
depends on nothing, and the Finanza group is hidden until there are accounts, so
it ships before the module exists.

### Plan 2 — The core

`FinanceAccount`, `Movement`, `ImportBatch`, `visibleAccountIds`, the three
readers, the import with its preview and its duplicate counting, the accounts
screen, the movements list and the detail. Balances work, because they only need
the opening balance and the movements.

At the end of this the money is in the app and can be looked at. Still no
categories, and the detail's «what you decided» half holds only the note.

### Plan 3 — The meaning

`Category`, `CategoryRule`, `TransferLink`, the three sieves, the one-tap rule and
applying backwards, pairing and confirmation, the rules screen, and the summary.

**The split between 2 and 3 is deliberate**: plan 2 carries all the technical
risk — the real shape of three files nobody has parsed yet — and plan 3 carries
all the value. If a reader turns out worse than expected, plan 2 finds out, where
it is cheap.

### Before plan 2 can start

One real export per provider is needed, covering a month with at least one
transfer between two of the accounts in it. The readers are written against those
files and the files become the test fixtures. Without them the readers are
written against a guess.

Two things those files will settle, and neither can be settled before seeing
them: whether Intesa Sanpaolo exports CSV or only XLSX — and therefore whether
this module needs a spreadsheet-reading dependency or a conversion by hand — and
whether Satispay's export carries a transaction identifier, which decides whether
its import leans on the counting of §5.3 or never needs it.
