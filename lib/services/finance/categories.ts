import { db } from "@/lib/db"
import type { CategoryInput, CategoryKind } from "@/lib/schemas/finance"

export type CategorySummary = {
  id: string
  name: string
  kind: CategoryKind
  archived: boolean
  usedIn: number
}

/** Thrown when a category is saved under a name another one already has. */
export class CategoryExistsError extends Error {
  constructor() {
    super("A category with that name already exists.")
    this.name = "CategoryExistsError"
  }
}

/** Thrown when nothing in the database carries the TRANSFER kind. */
export class NoTransferCategoryError extends Error {
  constructor() {
    super("No category has kind TRANSFER. Run the seed.")
    this.name = "NoTransferCategoryError"
  }
}

/**
 * Every category, in the order a picker should offer them.
 *
 * Household-wide, so it takes no actor: a category is a shared word, not a
 * private one. The count of movements is what makes archiving a considered act
 * rather than a guess.
 *
 * @returns the categories, archived ones last
 */
export async function listCategories(): Promise<CategorySummary[]> {
  const rows = await db.category.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      archived: true,
      _count: { select: { movements: true } },
    },
    orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    archived: row.archived,
    usedIn: row._count.movements,
  }))
}

/**
 * The id of the one category confirming a transfer assigns.
 *
 * @returns its id
 * @throws NoTransferCategoryError when the seed has never run
 */
export async function transferCategoryId(): Promise<string> {
  const row = await db.category.findFirst({
    where: { kind: "TRANSFER" },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  })

  if (row === null) throw new NoTransferCategoryError()
  return row.id
}

/**
 * Adds a category to the vocabulary.
 *
 * @param input - the validated form
 * @returns the new category's id
 * @throws CategoryExistsError when the name is taken
 */
export async function createCategory(input: CategoryInput): Promise<string> {
  const existing = await db.category.findUnique({
    where: { name: input.name },
    select: { id: true },
  })
  if (existing !== null) throw new CategoryExistsError()

  const last = await db.category.findFirst({
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  })

  const created = await db.category.create({
    data: { ...input, sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: { id: true },
  })

  return created.id
}

/**
 * Renames a category, changes its kind, or takes it out of the pickers.
 *
 * Archiving rather than deleting: a deleted category would either orphan the
 * movements that carry it or recategorise them, and both rewrite the past.
 *
 * @param id - the category's id
 * @param input - the validated form
 * @returns nothing
 * @throws CategoryExistsError when the new name belongs to another category
 */
export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<void> {
  const clash = await db.category.findFirst({
    where: { name: input.name, id: { not: id } },
    select: { id: true },
  })
  if (clash !== null) throw new CategoryExistsError()

  await db.category.update({ where: { id }, data: input })
}
