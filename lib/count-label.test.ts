import { describe, expect, it } from "vitest"

import { countLabel } from "@/lib/count-label"

const FOUND = {
  none: "Nessuna voce trovata.",
  one: "voce trovata",
  many: "voci trovate",
}

describe("countLabel", () => {
  it("uses the caller's whole sentence for none", () => {
    // Not a prefix on `one`: /spesa says «Tutto preso.» here, which shares no
    // word with the other two branches.
    expect(countLabel(0, FOUND)).toBe("Nessuna voce trovata.")
  })

  it("says one without pluralising", () => {
    expect(countLabel(1, FOUND)).toBe("1 voce trovata.")
  })

  it("says the count with the plural forms", () => {
    expect(countLabel(6, FOUND)).toBe("6 voci trovate.")
  })

  it("agrees with a masculine noun when the caller says so", () => {
    // The reason the words are the caller's: nothing here can know that
    // "articolo" takes "trovati" where "voce" takes "trovate".
    expect(
      countLabel(3, {
        none: "Nessun articolo trovato.",
        one: "articolo trovato",
        many: "articoli trovati",
      })
    ).toBe("3 articoli trovati.")
  })
})
