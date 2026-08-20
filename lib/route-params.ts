/**
 * The plain text behind a dynamic route segment.
 *
 * Next hands `params` the segment exactly as it appears in the URL, still
 * percent-encoded — so a catalogue entry linked as `/catalogo/aceto%20balsamico/edit`
 * arrives as `"aceto%20balsamico"` and matches no row. Decoding is the caller's
 * job, and it is the same job whether the page was loaded cold or reached by a
 * client-side navigation.
 *
 * @param raw - the segment as Next delivers it
 * @returns the decoded text, or null when the escape sequence is malformed
 */
export function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    // A route segment is a public endpoint: anything can be typed into the
    // address bar. `decodeURIComponent` throws a URIError on a broken escape,
    // which would answer 500 where the page means 404.
    return null
  }
}
