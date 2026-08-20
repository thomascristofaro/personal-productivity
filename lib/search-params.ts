/**
 * The first value of a search param.
 *
 * Next resolves a repeated `?q=` to a string array, not a string, so a param
 * has to be typed as Next actually delivers it and narrowed here.
 *
 * @param raw - what Next put in the resolved searchParams
 * @returns the first value, or undefined
 */
export function firstOf(
  raw: string | string[] | undefined
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw
}
