"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import {
  type ImportReply,
  importStatement,
  previewStatement,
} from "@/app/(app)/finance/import/actions"
import { DataRow } from "@/components/page/data-row"
import { SelectField } from "@/components/page/fields"
import { FormField } from "@/components/page/form-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { countLabel } from "@/lib/count-label"

export type ImportAccount = { id: string; name: string }

// The browser's own limit, matching the server's. Refused before the file is
// read, so a huge file never becomes a megabyte of string in memory. Three
// quarters of a megabyte, because the file travels base64-encoded and that
// costs a third more than the bytes it carries.
const MAX_BYTES = 750_000

// The file is sent as bytes, not as text: Satispay's export is a workbook, and
// reading it as text destroys it. Encoded in chunks because spreading a whole
// file into String.fromCharCode overflows the call stack somewhere above a
// hundred thousand bytes.
async function encode(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ""
  for (let at = 0; at < bytes.length; at += 8192) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 8192))
  }
  return btoa(binary)
}

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

// Zero never renders — the alert is guarded on a count above it — but one and
// many are two different sentences in Italian, which is what countLabel is for.
const UNREADABLE = {
  none: "",
  one: "riga non si legge",
  many: "righe non si leggono",
}

function Period({ from, to }: { from: Date | null; to: Date | null }) {
  if (from === null || to === null) return <>nessuna data leggibile</>

  const start = day.format(new Date(from))
  const end = day.format(new Date(to))

  // "dal 2 agosto al 2 agosto" is how a one-day export would read otherwise.
  return start === end ? (
    <>{start}</>
  ) : (
    <>
      dal {start} al {end}
    </>
  )
}

export function ImportPanel({ accounts }: { accounts: ImportAccount[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [file, setFile] = useState<{ name: string; content: string } | null>(
    null
  )
  const [reply, setReply] = useState<ImportReply | null>(null)
  const [isPending, startTransition] = useTransition()

  // The file stays here between the preview and the write. That is what makes
  // the preview possible at all: a file input cannot be re-submitted after a
  // round trip, and nothing is stored on the server in between.
  const choose = (chosen: File | undefined) => {
    setReply(null)
    setFile(null)
    if (chosen === undefined) return

    if (chosen.size > MAX_BYTES) {
      setReply({
        ok: false,
        message: "Il file è troppo grande. Esporta un periodo più corto.",
      })
      return
    }

    startTransition(async () => {
      const content = await encode(chosen)
      setFile({ name: chosen.name, content })
      setReply(
        await previewStatement({ accountId, fileName: chosen.name, content })
      )
    })
  }

  const write = () => {
    if (file === null) return
    startTransition(async () => {
      setReply(
        await importStatement({
          accountId,
          fileName: file.name,
          content: file.content,
        })
      )
    })
  }

  const reset = () => {
    setFile(null)
    setReply(null)
  }

  const preview = reply?.ok === true ? reply.preview : undefined
  const outcome = reply?.ok === true ? reply.outcome : undefined

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup>
        <SelectField
          id="accountId"
          name="accountId"
          label="Conto"
          description="Decide come viene letto il file."
          value={accountId}
          onValueChange={(next) => {
            setAccountId(next ?? "")
            reset()
          }}
          options={Object.fromEntries(
            accounts.map((account) => [account.id, account.name])
          )}
        />

        <FormField
          name="file"
          label="File"
          description="Il file esportato dal servizio: CSV per Revolut e Intesa, XLSX per Satispay."
        >
          <Input
            id="file"
            name="file"
            type="file"
            // FormField writes the description but cannot reach into its child
            // to point at it, so the call site does. Worth the line here: the
            // description is what says which of the two formats this account
            // wants, and a screen reader would otherwise never hear it.
            aria-describedby="file-description"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={isPending}
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              // Cleared straight away, so choosing the *same* file again still
              // fires a change. Without this, re-importing a file to check that
              // it is recognised as a duplicate does nothing at all, and the
              // previous outcome stays on screen reading as if it had.
              event.target.value = ""
              choose(chosen)
            }}
          />
        </FormField>
      </FieldGroup>

      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Leggo il file…
        </p>
      ) : null}

      {/* The default variant with a red title, not `variant="destructive"`:
          that variant paints the description red too, through a child selector
          a utility class cannot override, and the two column lists are the
          evidence rather than more of the complaint. In this theme the variants
          differ only in text colour, so nothing else is lost. */}
      {reply?.ok === false ? (
        <Alert>
          <AlertTitle className="text-destructive">{reply.message}</AlertTitle>
          {reply.expected === undefined ? null : (
            <AlertDescription className="pt-1 text-xs">
              {/* Printed rather than logged: this is how a reader built on a
                  guessed layout gets corrected against the first real file. */}
              <p className="mb-0!">
                Colonne attese: {reply.expected.join(", ")}
              </p>
              <p>
                Colonne trovate:{" "}
                {reply.found?.length ? reply.found.join(", ") : "nessuna"}
              </p>
            </AlertDescription>
          )}
        </Alert>
      ) : null}

      {preview !== undefined ? (
        <Card className="gap-3 p-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{preview.accountName}</p>
            <p className="text-sm text-muted-foreground">
              <Period from={preview.periodFrom} to={preview.periodTo} />
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <DataRow label="Movimenti nuovi">{preview.newCount}</DataRow>
            <DataRow label="Già presenti">{preview.duplicateCount}</DataRow>
          </div>

          {preview.unreadable > 0 ? (
            // `status` and not the Alert's own `alert`: this is a warning on a
            // screen the user is already reading, not an interruption.
            <Alert role="status">
              <AlertTitle className="text-destructive">
                {countLabel(preview.unreadable, UNREADABLE)}
              </AlertTitle>
              {/* Says nothing about how many, so it agrees with a title that
                  may be singular or plural — and it answers the question the
                  warning raises: the rest still arrives. */}
              <AlertDescription>
                Il resto viene importato lo stesso. Controlla il file prima di
                continuare.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-2">
            <Button
              onClick={write}
              disabled={isPending || preview.newCount === 0}
            >
              Importa
            </Button>
            <Button variant="ghost" onClick={reset} disabled={isPending}>
              Annulla
            </Button>
          </div>
        </Card>
      ) : null}

      {outcome !== undefined ? (
        <Card className="gap-3 p-4">
          <p role="status" className="font-medium">
            Importati {outcome.newCount} movimenti su {outcome.accountName}.
          </p>
          <p className="text-sm text-muted-foreground">
            {outcome.duplicateCount} righe erano già presenti.
          </p>
          <div className="flex gap-2">
            <Button
              render={<Link href="/finance/movements" />}
              nativeButton={false}
            >
              Vedi i movimenti
            </Button>
            <Button
              variant="outline"
              render={<Link href="/finance" />}
              nativeButton={false}
            >
              Riepilogo
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
