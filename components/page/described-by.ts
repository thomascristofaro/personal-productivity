/**
 * Adds the description's id to whatever `fieldProps` already produced.
 *
 * `fieldProps` emits only the error's id, because it does not know whether the
 * call site passed a description. The field component does.
 *
 * @param id - the field's id, which the description's id is built from
 * @param hasDescription - whether a description is being rendered
 * @param fromField - the `aria-describedby` that arrived in the spread
 * @returns the merged value, or undefined when there is nothing to point at
 */
export function mergeDescribedBy(
  id: string,
  hasDescription: boolean,
  fromField: string | undefined
): string | undefined {
  const ids = [hasDescription ? `${id}-description` : null, fromField ?? null]
    .filter((value) => value !== null)
    .join(" ")

  return ids === "" ? undefined : ids
}
