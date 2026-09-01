-- The provider categories that mean one thing and only one thing.
--
-- Same reasoning as prisma/migrations/20260823152937_seed_finance_categories:
-- data in a migration, because `prisma migrate deploy` runs on every build and
-- prisma/seed.ts does not.
--
-- Deliberately four and not forty. `PROVIDER_CATEGORY_IS` matches the whole
-- declared value, so a rule written from a string nobody has read off a real
-- export is a row that never fires and that everybody afterwards believes is
-- working. These four come from files that went through the readers:
-- «Stipendi e pensioni» and «Bonifici ricevuti» from the owner's Intesa export
-- of August 2026, «Ricarica» from the Revolut one, and FEE from revolut.ts,
-- which writes it on the commission it splits out of a payment.
--
-- Left out on purpose, because they are a kind of transaction and not a
-- category: Intesa's «Addebiti vari» and Revolut's «Pagamento con carta», each
-- true of most of its file. Satispay's «🏦 Dalla Banca» and «👤 da una Persona»
-- would qualify, but no export in the repository spells them, and a guessed
-- string here is a dead row. Everything else is the owner's own work on the
-- movements screen — section 6.2.
--
-- accountId is NULL, meaning every account: an account is created by hand at
-- run time, so a migration has no id to point at. The four values are
-- distinctive enough that this costs nothing.

INSERT INTO "CategoryRule" ("id", "kind", "pattern", "categoryId", "priority", "accountId", "createdAt")
SELECT "id", 'PROVIDER_CATEGORY_IS'::"RuleKind", "pattern", "categoryId", 0, NULL, now()
FROM (VALUES
  ('cfinrulestipendi',    'Stipendi e pensioni', 'cfincatstipendio'),
  ('cfinrulebonifici',    'Bonifici ricevuti',   'cfincataltreentrate'),
  ('cfinrulericarica',    'Ricarica',            'cfincattrasferimento'),
  ('cfinrulecommissione', 'FEE',                 'cfincataltreuscite')
) AS seeded ("id", "pattern", "categoryId")
-- A category renamed or deleted by hand since would make this a foreign key
-- violation on deploy.
WHERE EXISTS (SELECT 1 FROM "Category" WHERE "Category"."id" = seeded."categoryId")
ON CONFLICT ("id") DO NOTHING;
