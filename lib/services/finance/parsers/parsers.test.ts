import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { readerFor } from "@/lib/services/finance/parsers"
import { UnrecognisedFileError } from "@/lib/services/finance/parsers/types"

const bytes = (text: string) => new TextEncoder().encode(text)

// The header and the spellings of a real export of August 2026, with invented
// counterparties. Revolut translates the header into the account's language and
// then leaves "State" in English while translating its values, which is why
// both of those are worth a fixture rather than a guess.
const revolutFile = bytes(
  [
    "Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo",
    "Pagamento con carta,Attuale,2026-07-15 9:12:00,2026-07-15 9:12:00,Esselunga,-42.3,0,EUR,COMPLETATO,1200",
    "Ricarica,Attuale,2026-07-16 10:00:00,2026-07-16 10:00:00,Ricarica di *1234,200,0,EUR,COMPLETATO,1400",
    // No completion date and no balance, exactly as a cancelled row is written.
    "Pagamento con carta,Attuale,2026-07-17 10:00:00,,Bar,-1.5,0,EUR,OPERAZIONE ANNULLATA,",
    "Pagamento con carta,Attuale,2026-07-18 1:49:51,2026-07-19 5:51:27,Servizio estero,-7.51,0.08,EUR,COMPLETATO,1350.11",
  ].join("\n")
)

const revolutInEnglish = bytes(
  [
    "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
    "CARD_PAYMENT,Current,2026-07-15 09:12:00,2026-07-15 09:12:00,Esselunga,-42.30,0.00,EUR,COMPLETED,1200.00",
  ].join("\n")
)

// The owner's own «Lista Operazioni» of August 2026, with the counterparties,
// the account numbers and the salary replaced, plus two rows added: one not yet
// booked and one whose amount is text. Its five rows:
//
//   22/08  Revolut**0000* Dublin              -200,00  contabilizzato
//   17/08  Bonifico disposto da ROSSI MARIO   +500,00  contabilizzato
//   30/07  Stipendio O Pensione             +1.900,00  contabilizzato
//   25/07  ESSELUNGA SPA MILANO                -42,30  NON contabilizzato
//   24/07  Riga rotta                             n/d  contabilizzato
const intesaFile = new Uint8Array(
  readFileSync(new URL("./__fixtures__/intesa.xlsx", import.meta.url))
)

// Not an export of anything: what the readers are handed when the file is a CSV
// and they wanted a workbook, or the other way round.
const notAStatement = bytes(["Nome,Cognome", "Mario,Rossi"].join("\n"))

// A workbook of the shape Satispay exports — two sheets, an emoji in the state
// and in the kind, an instruction inside the id column's name. Its five rows:
//
//   15/07  Supermercato Aurora  -25,00  approved, -9,00 of it in euro and -16,00 in vouchers
//   16/07  Bar Centrale          -3,50  approved, no voucher
//   17/07  Ricarica Satispay    +50,00  approved, from the bank
//   18/07  Anna B.              -10,00  CANCELLED
//   19/07  Riga rotta              n/d  approved, but the amount is not a number
const satispayFile = new Uint8Array(
  readFileSync(new URL("./__fixtures__/satispay.xlsx", import.meta.url))
)

describe("the Revolut reader", () => {
  const read = readerFor("REVOLUT")

  it("reads a card payment as a negative amount on the day it was made", async () => {
    const first = (await read(revolutFile)).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.description).toBe("Esselunga")
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("dates a payment that settled the next day on the day it was made", async () => {
    const abroad = (await read(revolutFile)).movements.find(
      (m) => m.description === "Servizio estero"
    )
    // Started on the 18th, completed on the 19th.
    expect(abroad?.date.toISOString()).toBe("2026-07-18T00:00:00.000Z")
  })

  it("takes the row's Tipo as the category the provider declared", async () => {
    expect((await read(revolutFile)).movements[0]?.providerCategory).toBe(
      "Pagamento con carta"
    )
  })

  it("skips a cancelled row, because it may still be reverted", async () => {
    const result = await read(revolutFile)
    expect(result.movements.some((m) => m.description === "Bar")).toBe(false)
    // Not counted as unreadable either: nothing about it is broken, and a
    // warning on every import would train the owner to ignore the count.
    expect(result.unreadable).toBe(0)
  })

  it("emits a fee as its own movement, so it is not hidden inside another", async () => {
    const fee = (await read(revolutFile)).movements.find((m) =>
      m.description.startsWith("Commissione")
    )
    expect(fee?.amountCents).toBe(-8)
    expect(fee?.description).toBe("Commissione — Servizio estero")
  })

  it("counts every data row it was given", async () => {
    expect((await read(revolutFile)).rowsRead).toBe(4)
  })

  it("reads an export whose header came out in English", async () => {
    const first = (await read(revolutInEnglish)).movements[0]
    expect(first?.amountCents).toBe(-4230)
    expect(first?.providerCategory).toBe("CARD_PAYMENT")
  })

  it("refuses a file whose columns are somebody else's", async () => {
    await expect(read(intesaFile)).rejects.toThrow(UnrecognisedFileError)
  })
})

describe("the Intesa reader", () => {
  const read = readerFor("INTESA")

  it("finds the header under the export's eighteen rows of preamble", async () => {
    expect((await read(intesaFile)).rowsRead).toBe(5)
  })

  it("reads the amount and the day the movement was made", async () => {
    const first = (await read(intesaFile)).movements[0]
    expect(first?.amountCents).toBe(-20000)
    expect(first?.date.toISOString()).toBe("2026-08-22T00:00:00.000Z")
  })

  it("takes the description from Operazione, which carries the counterparty", async () => {
    expect((await read(intesaFile)).movements[0]?.description).toBe(
      "Revolut**0000* Dublin"
    )
  })

  it("keeps the declared category verbatim", async () => {
    expect((await read(intesaFile)).movements[0]?.providerCategory).toBe(
      "Addebiti vari"
    )
  })

  it("reads an amount the workbook stored as a number", async () => {
    const salary = (await read(intesaFile)).movements.find(
      (m) => m.description === "Stipendio O Pensione"
    )
    expect(salary?.amountCents).toBe(190000)
  })

  it("skips a movement that is not booked yet, because its date can still move", async () => {
    const result = await read(intesaFile)
    expect(
      result.movements.some((m) => m.description === "ESSELUNGA SPA MILANO")
    ).toBe(false)
    // Not unreadable: the row is fine, it is simply not final.
    expect(result.movements).toHaveLength(3)
  })

  it("counts a row whose amount is not a number", async () => {
    expect((await read(intesaFile)).unreadable).toBe(1)
  })

  it("refuses a file that is not a workbook at all", async () => {
    await expect(read(notAStatement)).rejects.toThrow(UnrecognisedFileError)
  })
})

describe("the Satispay reader", () => {
  const read = readerFor("SATISPAY")

  it("finds the transactions among the workbook's other sheets", async () => {
    const result = await read(satispayFile)
    expect(result.rowsRead).toBe(5)
  })

  it("reads the amount, the counterparty and the day", async () => {
    const first = (await read(satispayFile)).movements[0]
    expect(first?.amountCents).toBe(-2500)
    expect(first?.description).toBe("Supermercato Aurora")
    expect(first?.date.toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("keeps the provider's own id, which makes duplicates exact", async () => {
    expect((await read(satispayFile)).movements[0]?.providerRef).toBe(
      "11111111-1111-4111-8111-111111111111"
    )
  })

  it("keeps the declared kind, emoji and all, for the provider map", async () => {
    expect((await read(satispayFile)).movements[0]?.providerCategory).toBe(
      "🏬 a un Negozio"
    )
  })

  it("skips a cancelled payment", async () => {
    const result = await read(satispayFile)
    expect(result.movements.some((m) => m.description === "Anna B.")).toBe(
      false
    )
  })

  it("counts a row whose amount is not a number", async () => {
    expect((await read(satispayFile)).unreadable).toBe(1)
  })

  it("adds the voucher back as its own movement, so the expense stays whole", async () => {
    const voucher = (await read(satispayFile)).movements[1]
    expect(voucher?.amountCents).toBe(1600)
    expect(voucher?.providerCategory).toBe("Buono")
    // Its own reference, or the two rows would share a fingerprint and the
    // second import of the same file would see one of them as new.
    expect(voucher?.providerRef).toBe(
      "11111111-1111-4111-8111-111111111111:voucher"
    )
  })

  it("makes the payment and its voucher sum to what the euro balance did", async () => {
    const [payment, voucher] = (await read(satispayFile)).movements
    // The file says availability moved by -9,00 while the payment cost -25,00.
    expect((payment?.amountCents ?? 0) + (voucher?.amountCents ?? 0)).toBe(-900)
  })

  it("leaves a payment with no voucher as one movement", async () => {
    const bar = (await read(satispayFile)).movements.filter(
      (m) => m.description === "Bar Centrale"
    )
    expect(bar).toHaveLength(1)
    expect(bar[0]?.amountCents).toBe(-350)
  })

  it("refuses a file that is not a workbook at all", async () => {
    await expect(read(notAStatement)).rejects.toThrow(UnrecognisedFileError)
  })

  // The message is how the first export of a format nobody has seen diagnoses
  // itself, so it has to name the header the file really has — not the row of
  // empty cells an export with a preamble opens on.
  it("names the header it found when the workbook is another provider's", async () => {
    await expect(read(intesaFile)).rejects.toMatchObject({
      found: expect.arrayContaining(["Data", "Operazione", "Importo"]),
    })
  })
})

describe("every reader", () => {
  it("counts a row it cannot read instead of dropping it in silence", async () => {
    const broken = bytes(
      [
        "Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo",
        "Pagamento con carta,Attuale,2026-07-15 9:12:00,2026-07-15 9:12:00,Rotto,n/d,0,EUR,COMPLETATO,0",
      ].join("\n")
    )

    const result = await readerFor("REVOLUT")(broken)
    expect(result.movements).toHaveLength(0)
    expect(result.unreadable).toBe(1)
    expect(result.rowsRead).toBe(1)
  })

  // The upload's only lossy step. A workbook that survives the CSV readers but
  // not this would fail on the one path no unit test covers.
  it("survives the base64 the browser and the server action pass it through", async () => {
    let binary = ""
    for (let at = 0; at < satispayFile.length; at += 8192) {
      binary += String.fromCharCode(...satispayFile.subarray(at, at + 8192))
    }
    const encoded = btoa(binary)
    const decoded = Buffer.from(encoded, "base64")

    expect(Buffer.from(satispayFile).equals(decoded)).toBe(true)
    expect((await readerFor("SATISPAY")(decoded)).movements).toHaveLength(4)
  })

  it("refuses an empty file", async () => {
    await expect(readerFor("REVOLUT")(bytes(""))).rejects.toThrow(
      UnrecognisedFileError
    )
    await expect(readerFor("SATISPAY")(bytes(""))).rejects.toThrow(
      UnrecognisedFileError
    )
  })
})
