/**
 * The sentence a list announces to a screen reader.
 *
 * Zero, one and many are three different strings in Italian, and the words
 * agree with the noun — «voci trovate» but «articoli trovati» — so the caller
 * supplies the words and this supplies the shape. The zero case is a whole
 * sentence rather than a prefix because it is not always the same sentence:
 * an empty shopping list says «Tutto preso.», not «Nessun articolo».
 *
 * @param count - how many things the list is about to render
 * @param forms - the sentence for none, and the noun phrase for one and many
 * @returns the sentence, punctuated
 */
export function countLabel(
  count: number,
  forms: { none: string; one: string; many: string }
): string {
  if (count === 0) return forms.none
  if (count === 1) return `1 ${forms.one}.`
  return `${count} ${forms.many}.`
}
