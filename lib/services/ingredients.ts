import { AISLE_ORDER } from "@/lib/aisles"
import { db } from "@/lib/db"
import type { IngredientInput } from "@/lib/schemas/ingredient"

/** Thrown by `createIngredient` when the name is already in the catalogue. */
export class IngredientExistsError extends Error {
  constructor(name: string) {
    super(`An ingredient named ${name} already exists.`)
    this.name = "IngredientExistsError"
  }
}

/** Thrown when an aisle is not one of the walking-order values. */
export class UnknownAisleError extends Error {
  constructor(aisle: string) {
    super(`${aisle} is not a known aisle.`)
    this.name = "UnknownAisleError"
  }
}

/** Thrown by `deleteIngredient` when a recipe still uses the ingredient. */
export class IngredientInUseError extends Error {
  constructor() {
    super("The ingredient is still used by at least one recipe.")
    this.name = "IngredientInUseError"
  }
}

/** Thrown when the named ingredient is not in the catalogue. */
export class IngredientNotFoundError extends Error {
  constructor() {
    super("No ingredient with this name.")
    this.name = "IngredientNotFoundError"
  }
}

export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

export type IngredientRow = {
  name: string
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
 * Lists the whole catalogue, alphabetically.
 *
 * The catalogue is small — hundreds of rows at most — so it is loaded whole and
 * filtered in the browser rather than queried per keystroke.
 *
 * @returns Every ingredient, ordered by name.
 */
export async function listIngredients(): Promise<IngredientOption[]> {
  return db.ingredient.findMany({
    select: { name: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Finds one catalogue entry by its exact name.
 *
 * Matching is exact, not normalised: the name is a primary key, and the caller
 * either picked it from the catalogue or just created it.
 *
 * @param name The exact ingredient name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function findIngredientByName(
  name: string
): Promise<IngredientOption | null> {
  return db.ingredient.findUnique({
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
 * aisle is how a form gets abandoned.
 *
 * @param name The ingredient name, already trimmed and validated by the caller.
 * @returns The new catalogue entry.
 * @throws IngredientExistsError When the name is already in the catalogue.
 */
export async function createIngredient(
  name: string
): Promise<IngredientOption> {
  try {
    return await db.ingredient.create({
      data: { name },
      select: { name: true, defaultUnit: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new IngredientExistsError(name)
    throw error
  }
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
 * Lists the catalogue with the number of recipes using each entry.
 *
 * The count is what tells the user which entries are safe to delete, so it is
 * part of the list rather than something the detail screen reveals later.
 *
 * @param query An optional case-insensitive fragment of the name.
 * @returns Every matching ingredient, ordered by name.
 */
export async function listIngredientsWithUsage(
  query?: string
): Promise<IngredientRow[]> {
  const trimmed = query?.trim()

  const rows = await db.ingredient.findMany({
    where: trimmed
      ? { name: { contains: trimmed, mode: "insensitive" } }
      : undefined,
    select: {
      name: true,
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
 * @param name The exact ingredient name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function getIngredient(
  name: string
): Promise<IngredientRow | null> {
  const row = await db.ingredient.findUnique({
    where: { name },
    select: {
      name: true,
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
 * Adds a fully specified ingredient to the catalogue.
 *
 * Distinct from `createIngredient`, which is the bare inline path used while
 * writing a recipe and deliberately sets no unit and no aisle.
 *
 * @param input The validated ingredient.
 * @returns Nothing.
 * @throws UnknownAisleError When the aisle is not in the walking order.
 * @throws IngredientExistsError When the name is already in the catalogue.
 */
export async function createFullIngredient(
  input: IngredientInput
): Promise<void> {
  if (!isKnownAisle(input.aisle)) throw new UnknownAisleError(input.aisle)

  try {
    await db.ingredient.create({ data: input })
  } catch (error) {
    if (isUniqueViolation(error)) throw new IngredientExistsError(input.name)
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
 * @param name The ingredient's current name.
 * @param input The validated new values.
 * @returns Nothing.
 * @throws UnknownAisleError When the aisle is not in the walking order.
 * @throws IngredientExistsError When the new name is already taken.
 * @throws IngredientNotFoundError When no ingredient has the current name.
 */
export async function updateIngredient(
  name: string,
  input: IngredientInput
): Promise<void> {
  if (!isKnownAisle(input.aisle)) throw new UnknownAisleError(input.aisle)

  try {
    await db.ingredient.update({ where: { name }, data: input })
  } catch (error) {
    if (isUniqueViolation(error)) throw new IngredientExistsError(input.name)
    if (isRecordNotFoundError(error)) throw new IngredientNotFoundError()
    throw error
  }
}

/**
 * Removes an ingredient no recipe uses.
 *
 * The relation is `onDelete: Restrict`, so the database refuses when a recipe
 * still references it. That refusal is the check — reading the count first and
 * then deleting would leave a race between the two.
 *
 * @param name The ingredient's name.
 * @returns Nothing.
 * @throws IngredientInUseError When a recipe still uses the ingredient.
 * @throws IngredientNotFoundError When no ingredient has that name.
 */
export async function deleteIngredient(name: string): Promise<void> {
  try {
    await db.ingredient.delete({ where: { name } })
  } catch (error) {
    if (isForeignKeyError(error)) throw new IngredientInUseError()
    if (isRecordNotFoundError(error)) throw new IngredientNotFoundError()
    throw error
  }
}
