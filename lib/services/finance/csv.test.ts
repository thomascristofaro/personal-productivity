import { describe, expect, it } from "vitest"

import { splitCsv } from "@/lib/services/finance/csv"

describe("splitCsv", () => {
  it("reads plain comma-separated rows", () => {
    expect(splitCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("picks the semicolon when the header uses one", () => {
    expect(splitCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("looks past a preamble that holds no separator at all", () => {
    // The Intesa export opens with a title and an account number. Choosing the
    // delimiter from the first line alone gives every row one column, and the
    // reader below never finds its header.
    const file = ["Elenco movimenti", "Conto: IT00X000", "", "a,b", "1,2"].join(
      "\n"
    )

    expect(splitCsv(file).at(-1)).toEqual(["1", "2"])
  })

  it("keeps a comma that is inside quotes", () => {
    expect(splitCsv('a,b\n"uno, due",3')).toEqual([
      ["a", "b"],
      ["uno, due", "3"],
    ])
  })

  it("keeps a newline that is inside quotes", () => {
    expect(splitCsv('a,b\n"uno\ndue",3')).toEqual([
      ["a", "b"],
      ["uno\ndue", "3"],
    ])
  })

  it("reads a doubled quote as one quote", () => {
    expect(splitCsv('a\n"lui disse ""ciao"""')).toEqual([
      ["a"],
      ['lui disse "ciao"'],
    ])
  })

  it("survives CRLF line endings", () => {
    expect(splitCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("strips a byte order mark, so the first header is not \\ufeffData", () => {
    expect(splitCsv("﻿Data,Importo\n1,2")[0]).toEqual(["Data", "Importo"])
  })

  it("drops trailing blank lines rather than emitting an empty row", () => {
    expect(splitCsv("a,b\n1,2\n\n")).toHaveLength(2)
  })

  it("returns nothing for an empty file", () => {
    expect(splitCsv("")).toEqual([])
  })

  it("keeps an empty field in the middle of a row", () => {
    expect(splitCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ])
  })
})
