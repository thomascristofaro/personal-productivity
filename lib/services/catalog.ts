import { AISLE_ORDER } from "@/lib/aisles"
import { db } from "@/lib/db"
import type { CatalogItemInput, CatalogItemKind } from "@/lib/schemas/catalog"

/** Thrown when the name is already in the catalogue. */
export class CatalogItemExistsError extends Error {
  constructor(name: string) {
    super(`A catalogue entry named ${name} already exists.`)
    this.name = "CatalogItemExistsError"
  }
}

/** Thrown when an aisle is not one of the walking-order values. */
export class UnknownAisleError extends Error {
  constructor(aisle: string) {
    super(`${aisle} is not a known aisle.`)
    this.name = "UnknownAisleError"
  }
}

/** Thrown by `deleteCatalogItem` when a recipe still uses the entry. */
export class CatalogItemInUseError extends Error {
  constructor() {
    super("The catalogue entry is still used by at least one recipe.")
    this.name = "CatalogItemInUseError"
  }
}

/** Thrown when the named entry is not in the catalogue. */
export class CatalogItemNotFoundError extends Error {
  constructor() {
    super("No catalogue entry with this name.")
    this.name = "CatalogItemNotFoundError"
  }
}

// Named for the caller, not for the table: this is what the recipe form's
// picker consumes, and it only ever sees entries of kind INGREDIENT.
export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

export type CatalogOption = IngredientOption & { aisle: string }

export type CatalogRow = {
  name: string
  kind: CatalogItemKind
  defaultUnit: string | null
  aisle: string
  usedIn: number
}

// Prisma's failure codes, read structurally so this module never imports a
// Prisma type outside lib/db.ts.
function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
}

const isUniqueViolation = (error: unknown) => hasPrismaCode(error, "P2002")
const isForeignKeyError = (error: unknown) => hasPrismaCode(error, "P2003")
const isRecordNotFoundError = (error: unknown) => hasPrismaCode(error, "P2025")

/**
 * Orders units by how often recipes use them, most used first.
 *
 * Exported for its own test: the ranking is the only logic in this module that
 * is worth asserting without a database.
 *
 * @param rows One entry per distinct unit, with the number of rows using it.
 * @returns The unit names, most used first, ties broken alphabetically.
 */
export function rankUnitsByUse(
  rows: { unit: string | null; uses: number }[]
): string[] {
  return rows
    .filter((row): row is { unit: string; uses: number } => {
      return typeof row.unit === "string" && row.unit.trim().length > 0
    })
    .sort((a, b) => b.uses - a.uses || a.unit.localeCompare(b.unit, "it"))
    .map((row) => row.unit)
}

/**
 * Checks an aisle against the supermarket walking order.
 *
 * Exported for its own test, and used as a guard before every write: an aisle
 * that is not in the order does not fail anywhere, it just sorts silently into
 * the catch-all, which is the kind of defect nobody reports.
 *
 * @param aisle The aisle to check.
 * @returns True when the aisle is one of the known values.
 */
export function isKnownAisle(aisle: string): boolean {
  return (AISLE_ORDER as readonly string[]).includes(aisle)
}

/**
 * Maps the `?tipo=` search param of the catalogue screen to a kind.
 *
 * A switch and not a lookup object: an object literal inherits from
 * `Object.prototype`, so `KIND_BY_CHIP["constructor"]` would hand Prisma a
 * function instead of undefined. Anything unrecognised filters nothing — a
 * search param is typed by hand as often as it is clicked, and a screen showing
 * zero rows for a typo reads as an empty catalogue.
 *
 * The chip values are Italian because they are in the address bar the user
 * sees; the kinds are English because they are database values.
 *
 * @param tipo The raw search param, or undefined when no chip is chosen.
 * @returns The kind to filter by, or undefined to filter by nothing.
 */
export function kindFilterFor(
  tipo: string | undefined
): CatalogItemKind | undefined {
  switch (tipo) {
    case "ingredienti":
      return "INGREDIENT"
    case "prodotti":
      return "PRODUCT"
    default:
      return undefined
  }
}

/**
 * Lists the entries a recipe may reference, alphabetically.
 *
 * Filtered to `INGREDIENT`, which is the whole reason the kind exists: the
 * picker inside the recipe form must never offer shampoo. The catalogue is
 * small — hundreds of rows at most — so it is loaded whole and filtered in the
 * browser rather than queried per keystroke.
 *
 * @returns Every ingredient, ordered by name.
 */
export async function listIngredientOptions(): Promise<IngredientOption[]> {
  return db.catalogItem.findMany({
    where: { kind: "INGREDIENT" },
    select: { name: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Lists the whole catalogue with each entry's aisle, for the shopping drawer.
 *
 * Both kinds, unlike `listIngredientOptions`: the point of the shopping list is
 * that anything can go on it. Distinct from `listCatalogItems`, which counts
 * recipes per entry and is the catalogue screen's query.
 *
 * @returns Every entry with its preferred unit and its aisle, by name.
 */
export async function listCatalogOptions(): Promise<CatalogOption[]> {
  return db.catalogItem.findMany({
    select: { name: true, defaultUnit: true, aisle: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Finds one catalogue entry by its exact name.
 *
 * Matching is exact, not fuzzy: the name is a primary key, the schema has
 * already lowercased it, and the caller either picked it from the catalogue or
 * just created it.
 *
 * @param name The exact entry name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function findIngredientByName(
  name: string
): Promise<IngredientOption | null> {
  return db.catalogItem.findUnique({
    where: { name },
    select: { name: true, defaultUnit: true },
  })
}

/**
 * Lists the units recipes actually use, most used first.
 *
 * Feeds the suggestions on the unit field, so the common three sit at the top
 * and a one-off unit stays possible.
 *
 * @returns The distinct non-empty units, most used first.
 */
export async function listUsedUnits(): Promise<string[]> {
  const rows = await db.recipeIngredient.groupBy({
    by: ["unit"],
    _count: { unit: true },
  })

  return rankUnitsByUse(
    rows.map((row) => ({ unit: row.unit, uses: row._count.unit }))
  )
}

/**
 * Adds an ingredient to the catalogue from the recipe form.
 *
 * Created without a unit or an aisle: the aisle defaults to the catch-all and
 * is corrected later, because interrupting a recipe to classify a supermarket
 * aisle is how a form gets abandoned. The kind is stated rather than left to
 * the column default — that default may change, and this call site must not.
 *
 * @param name The name, already normalised and validated by the caller.
 * @returns The new catalogue entry.
 * @throws CatalogItemExistsError When the name is already in the catalogue.
 */
export async function createIngredient(
  name: string
): Promise<IngredientOption> {
  try {
    return await db.catalogItem.create({
      data: { name, kind: "INGREDIENT" },
      select: { name: true, defaultUnit: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new CatalogItemExistsError(name)
    throw error
  }
}

/**
 * Lists the catalogue with the number of recipes using each entry.
 *
 * The count is what tells the user which entries are safe to delete, so it is
 * part of the list rather than something the detail screen reveals later.
 *
 * @param query An optional case-insensitive fragment of the name.
 * @param kind An optional kind to filter by; undefined lists both.
 * @returns Every matching entry, ordered by name.
 */
export async function listCatalogItems(
  query?: string,
  kind?: CatalogItemKind
): Promise<CatalogRow[]> {
  const trimmed = query?.trim()

  const rows = await db.catalogItem.findMany({
    where: {
      ...(trimmed ? { name: { contains: trimmed, mode: "insensitive" } } : {}),
      ...(kind === undefined ? {} : { kind }),
    },
    select: {
      name: true,
      kind: true,
      defaultUnit: true,
      aisle: true,
      _count: { select: { usedIn: true } },
    },
    orderBy: { name: "asc" },
  })

  return rows.map(({ _count, ...row }) => ({ ...row, usedIn: _count.usedIn }))
}

/**
 * Reads one catalogue entry with its usage count.
 *
 * @param name The exact entry name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function getCatalogItem(name: string): Promise<CatalogRow | null> {
  const row = await db.catalogItem.findUnique({
    where: { name },
    select: {
      name: true,
      kind: true,
      defaultUnit: true,
      aisle: true,
      _count: { select: { usedIn: true } },
    },
  })

  if (row === null) return null

  const { _count, ...rest } = row
  return { ...rest, usedIn: _count.usedIn }
}

/**
 * Adds a fully specified entry to the catalogue.
 *
 * Distinct from `createIngredient`, which is the bare inline path used while
 * writing a recipe and deliberately sets no unit and no aisle.
 *
 * @param input The validated entry, kind included.
 * @returns Nothing.
 * @throws UnknownAisleError When the aisle is not in the walking order.
 * @throws CatalogItemExistsError When the name is already in the catalogue.
 */
export async function createCatalogItem(
  input: CatalogItemInput
): Promise<void> {
  if (!isKnownAisle(input.aisle)) throw new UnknownAisleError(input.aisle)

  try {
    await db.catalogItem.create({ data: input })
  } catch (error) {
    if (isUniqueViolation(error)) throw new CatalogItemExistsError(input.name)
    throw error
  }
}

/**
 * Updates one catalogue entry, renaming it if the name changed.
 *
 * A rename rewrites the primary key. The relation carries `onUpdate: Cascade`,
 * so every recipe line following the old name moves with it in the same
 * statement — see docs/conventions/data.md.
 *
 * @param name The entry's current name.
 * @param input The validated new values, kind included.
 * @returns Nothing.
 * @throws UnknownAisleError When the aisle is not in the walking order.
 * @throws CatalogItemExistsError When the new name is already taken.
 * @throws CatalogItemNotFoundError When no entry has the current name.
 */
export async function updateCatalogItem(
  name: string,
  input: CatalogItemInput
): Promise<void> {
  if (!isKnownAisle(input.aisle)) throw new UnknownAisleError(input.aisle)

  try {
    await db.catalogItem.update({ where: { name }, data: input })
  } catch (error) {
    if (isUniqueViolation(error)) throw new CatalogItemExistsError(input.name)
    if (isRecordNotFoundError(error)) throw new CatalogItemNotFoundError()
    throw error
  }
}

/**
 * Removes a catalogue entry no recipe uses.
 *
 * The relation is `onDelete: Restrict`, so the database refuses when a recipe
 * still references it. That refusal is the check — reading the count first and
 * then deleting would leave a race between the two.
 *
 * @param name The entry's name.
 * @returns Nothing.
 * @throws CatalogItemInUseError When a recipe still uses the entry.
 * @throws CatalogItemNotFoundError When no entry has that name.
 */
export async function deleteCatalogItem(name: string): Promise<void> {
  try {
    await db.catalogItem.delete({ where: { name } })
  } catch (error) {
    if (isForeignKeyError(error)) throw new CatalogItemInUseError()
    if (isRecordNotFoundError(error)) throw new CatalogItemNotFoundError()
    throw error
  }
}
