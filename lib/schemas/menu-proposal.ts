import { z } from "zod"

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
    slots: z.array(
      z.object({
        day: z.number().int().min(0).max(6),
        meal: z.enum(["LUNCH", "DINNER"]),
        candidate: z.number().int().min(1).max(candidateCount).nullable(),
      })
    ),
  })
}

export type MenuProposal = z.infer<ReturnType<typeof menuProposalSchema>>
export type ProposedSlot = MenuProposal["slots"][number]
