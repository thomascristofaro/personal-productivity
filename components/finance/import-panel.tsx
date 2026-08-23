"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import {
  type ImportReply,
  importStatement,
  previewStatement,
} from "@/app/(app)/finance/import/actions"
import { SelectField } from "@/components/page/fields"
import { FormField } from "@/components/page/form-field"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type ImportAccount = { id: string; name: string }

// The browser's own limit, matching the server's. Refused before the file is
// read, so a huge file never becomes a megabyte of string in memory.
const MAX_BYTES = 1_000_000

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

function Period({ from, to }: { from: Date | null; to: Date | null }) {
  if (from === null || to === null) return <>nessuna data leggibile</>
  return (
    <>
      dal {day.format(new Date(from))} al {day.format(new Date(to))}
    </>
  )
}

export function ImportPanel({ accounts }: { accounts: ImportAccount[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [reply, setReply] = useState<ImportReply | null>(null)
  const [isPending, startTransition] = useTransition()

  // The file's text stays here between the preview and the write. That is what
  // makes the preview possible at all: a file input cannot be re-submitted
  // after a round trip, and nothing is stored on the server in between.
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
      const text = await chosen.text()
      setFile({ name: chosen.name, text })
      setReply(await previewStatement({ accountId, fileName: chosen.name, text }))
    })
  }

  const write = () => {
    if (file === null) return
    startTransition(async () => {
      setReply(
        await importStatement({
          accountId,
          fileName: file.name,
          text: file.text,
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
          description="Il CSV esportato dal servizio."
        >
          <Input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
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

      {reply?.ok === false ? (
        <Card className="gap-2 border-destructive/50 p-4">
          <p role="alert" className="text-sm text-destructive">
            {reply.message}
          </p>
          {reply.expected === undefined ? null : (
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {/* Printed rather than logged: this is how a reader built on a
                  guessed layout gets corrected against the first real file. */}
              <p>Colonne attese: {reply.expected.join(", ")}</p>
              <p>
                Colonne trovate:{" "}
                {reply.found?.length ? reply.found.join(", ") : "nessuna"}
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {preview !== undefined ? (
        <Card className="gap-3 p-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{preview.accountName}</p>
            <p className="text-sm text-muted-foreground">
              <Period from={preview.periodFrom} to={preview.periodTo} />
            </p>
          </div>

          <ul className="flex flex-col gap-1 text-sm">
            <li>{preview.newCount} movimenti nuovi</li>
            <li className="text-muted-foreground">
              {preview.duplicateCount} già presenti
            </li>
            {preview.unreadable > 0 ? (
              <li className="text-destructive">
                {preview.unreadable} righe illeggibili, che non verranno
                importate
              </li>
            ) : null}
          </ul>

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
