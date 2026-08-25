-- The rule that files a meal voucher as a transfer.
--
-- Satispay's export splits a payment part-covered by vouchers into what it cost
-- and what the euro balance did. The reader turns the difference into its own
-- movement so the balance still agrees with the app while the expense stays the
-- real one, and declares "Buono" as that movement's provider category.
--
-- Without this rule that movement is an uncategorised positive amount, which
-- section 8.2 counts as income: about €130 of invented earnings a month. It is
-- therefore what the module requires to be correct, not a convenience, so it
-- goes in a migration beside the categories it depends on — same reasoning as
-- prisma/migrations/20260823152937_seed_finance_categories.
--
-- A rule and not a branch in the reader: section 6.1 already owns the question
-- "what category does this movement take", and a second answer to it in the
-- parser would be the one nobody thinks to look at.

INSERT INTO "CategoryRule" ("id", "kind", "pattern", "categoryId", "priority", "accountId", "createdAt")
SELECT 'cfinrulebuonopasto', 'PROVIDER_CATEGORY_IS', 'Buono', 'cfincattrasferimento', 0, NULL, now()
-- The categories are inserted by an earlier migration, but one renamed or
-- deleted by hand since would make this a foreign key violation on deploy.
WHERE EXISTS (SELECT 1 FROM "Category" WHERE "id" = 'cfincattrasferimento')
ON CONFLICT ("id") DO NOTHING;
