import { z } from "zod"

/** Seven days, two meals. */
const SLOTS_IN_WEEK = 14

/**
 * The shape the model must answer a menu proposal in.
 *
 * `candidate` is a one-based index into the numbered list the prompt carried,
 * never a recipe id: an index can be bounded by the schema, so a recipe that
 * does not exist becomes impossible to express rather than something to detect
 * afterwards. Mapping back to ids is the service's job.
 */
export function menuProposalSchema(candidateCount: number) {
  return z.object({
    slots: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          meal: z.enum(["LUNCH", "DINNER"]),
          candidate: z.number().int().min(1).max(candidateCount).nullable(),
        })
      )
      // Fourteen cells exist and no more can be addressed.
      .max(SLOTS_IN_WEEK)
      // Two slots naming the same cell are not a duplicate recipe, so
      // `resolveProposal` would not catch them: the second write would
      // overwrite the first and the week would come back one meal short,
      // silently. Refusing here is what makes fourteen mean fourteen.
      .refine(
        (slots) =>
          new Set(slots.map((slot) => `${slot.day}-${slot.meal}`)).size ===
          slots.length,
        "Two slots address the same day and meal."
      ),
  })
}

export type MenuProposal = z.infer<ReturnType<typeof menuProposalSchema>>
export type ProposedSlot = MenuProposal["slots"][number]
