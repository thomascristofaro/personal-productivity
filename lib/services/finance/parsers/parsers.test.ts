import { describe, expect, it } from "vitest"

import { readerFor } from "@/lib/services/finance/parsers"
import { UnrecognisedFileError } from "@/lib/services/finance/parsers/types"

const revolutFile = [
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
  "CARD_PAYMENT,Current,2026-07-15 09:12:00,2026-07-15 09:12:00,Esselunga,-42.30,0.00,EUR,COMPLETED,1200.00",
  "TOPUP,Current,2026-07-16 10:00:00,2026-07-16 10:00:00,Payment from Thomas,200.00,0.00,EUR,COMPLETED,1400.00",
  "CARD_PAYMENT,Current,2026-07-17 10:00:00,2026-07-17 10:00:00,Bar,-1.50,0.00,EUR,PENDING,1398.50",
  "ATM,Current,2026-07-18 10:00:00,2026-07-18 10:00:00,Prelievo,-100.00,1.50,EUR,COMPLETED,1297.00",
].join("\n")

const intesaFile = [
  "Elenco movimenti",
  "Conto: IT00X0000000000000000000000",
  "",
  "Data,Operazione,Dettagli,Conto o carta,Contabilizzazione,Categoria,Valuta,Importo",
  '15/07/2026,Pagamento POS,"ESSELUNGA SPA, MILANO",Conto,15/07/2026,Spesa,EUR,"-42,30"',
  '16/07/2026,Bonifico,Stipendio,Conto,16/07/2026,Entrate,EUR,"1.850,00"',
].join("\n")

const satispayFile = [
  "ID,Data,Nome,Tipo,Stato,Importo",
  'abc123,15/07/2026,Bar Centrale,Pagamento,ACCETTATO,"-3,50"',
  'def456,16/07/2026,Marco,Ricarica,ACCETTATO,"25,00"',
].join("\n")

describe("the Revolut reader", () => {
  const read = readerFor("REVOLUT")

  it("reads a card payment as a negative amount on its completed date", () => {
    const first = read(revolutFile).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.description).toBe("Esselunga")
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("takes the row's Type as the category the provider declared", () => {
    expect(read(revolutFile).movements[0]?.providerCategory).toBe("CARD_PAYMENT")
  })

  it("skips a row that is not COMPLETED, because it may still be reversed", () => {
    expect(read(revolutFile).movements.some((m) => m.description === "Bar")).toBe(
      false
    )
  })

  it("emits a fee as its own movement, so it is not hidden inside another", () => {
    const fee = read(revolutFile).movements.find((m) =>
      m.description.startsWith("Commissione")
    )
    expect(fee?.amountCents).toBe(-150)
    expect(fee?.description).toBe("Commissione — Prelievo")
  })

  it("counts every data row it was given", () => {
    expect(read(revolutFile).rowsRead).toBe(4)
  })

  it("refuses a file whose columns are somebody else's", () => {
    expect(() => read(intesaFile)).toThrow(UnrecognisedFileError)
  })
})

describe("the Intesa reader", () => {
  const read = readerFor("INTESA")

  it("finds the header under the export's preamble", () => {
    expect(read(intesaFile).rowsRead).toBe(2)
  })

  it("reads an Italian amount and date", () => {
    const first = read(intesaFile).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("joins the operation and its details into one description", () => {
    expect(read(intesaFile).movements[0]?.description).toBe(
      "Pagamento POS — ESSELUNGA SPA, MILANO"
    )
  })

  it("keeps the declared category verbatim", () => {
    expect(read(intesaFile).movements[0]?.providerCategory).toBe("Spesa")
  })

  it("reads a thousands separator as thousands", () => {
    expect(read(intesaFile).movements[1]?.amountCents).toBe(185000)
  })
})

describe("the Satispay reader", () => {
  const read = readerFor("SATISPAY")

  it("keeps the provider's own id, which makes duplicates exact", () => {
    expect(read(satispayFile).movements[0]?.providerRef).toBe("abc123")
  })

  it("reads the amount and the counterparty", () => {
    const first = read(satispayFile).movements[0]
    expect(first?.amountCents).toBe(-350)
    expect(first?.description).toBe("Bar Centrale")
  })
})

describe("every reader", () => {
  it("counts a row it cannot read instead of dropping it in silence", () => {
    const broken = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "CARD_PAYMENT,Current,2026-07-15 09:12:00,2026-07-15 09:12:00,Rotto,n/d,0.00,EUR,COMPLETED,0",
    ].join("\n")

    const result = readerFor("REVOLUT")(broken)
    expect(result.movements).toHaveLength(0)
    expect(result.unreadable).toBe(1)
    expect(result.rowsRead).toBe(1)
  })

  it("refuses an empty file", () => {
    expect(() => readerFor("REVOLUT")("")).toThrow(UnrecognisedFileError)
  })
})
