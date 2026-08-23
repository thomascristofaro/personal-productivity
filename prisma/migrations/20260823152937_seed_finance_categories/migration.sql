-- The vocabulary the finance module starts from.
--
-- Data, in a migration rather than in prisma/seed.ts, because the module cannot
-- work without it: confirming a transfer assigns the one category whose kind is
-- TRANSFER, and with none present the service throws. `prisma migrate deploy`
-- already runs on every build; the seed does not, and wiring the whole seed into
-- the build would also re-upsert the users and resurrect catalogue rows somebody
-- deliberately deleted.
--
-- ON CONFLICT on the name, so this is safe on a database that already has them —
-- it inserts what is missing and touches nothing else. A category renamed or
-- archived later is not brought back: only a name nobody is using can be
-- inserted, and this migration runs once anyway.
--
-- The ids are fixed rather than generated. Category.id has no database default —
-- Prisma makes cuids in the client — so they have to be written here, and fixed
-- ones mean a fresh database gets the same ids everywhere. They satisfy
-- z.cuid(), which CategoryIdSchema uses: a `c` followed by lowercase
-- alphanumerics.

INSERT INTO "Category" ("id", "name", "kind", "sortOrder", "archived", "createdAt")
VALUES
  ('cfincatspesa',         'Spesa',            'EXPENSE',  0,  false, now()),
  ('cfincatristoranti',    'Ristoranti e bar', 'EXPENSE',  1,  false, now()),
  ('cfincatcasa',          'Casa e bollette',  'EXPENSE',  2,  false, now()),
  ('cfincattrasporti',     'Trasporti',        'EXPENSE',  3,  false, now()),
  ('cfincatsalute',        'Salute',           'EXPENSE',  4,  false, now()),
  ('cfincatabbonamenti',   'Abbonamenti',      'EXPENSE',  5,  false, now()),
  ('cfincattempolibero',   'Tempo libero',     'EXPENSE',  6,  false, now()),
  ('cfincatacquisti',      'Acquisti',         'EXPENSE',  7,  false, now()),
  ('cfincatcontanti',      'Contanti',         'EXPENSE',  8,  false, now()),
  ('cfincataltreuscite',   'Altre uscite',     'EXPENSE',  9,  false, now()),
  ('cfincatstipendio',     'Stipendio',        'INCOME',   10, false, now()),
  ('cfincataltreentrate',  'Altre entrate',    'INCOME',   11, false, now()),
  ('cfincattrasferimento', 'Trasferimento',    'TRANSFER', 12, false, now())
ON CONFLICT ("name") DO NOTHING;
