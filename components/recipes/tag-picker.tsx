"use client"

import { useState } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { matchesQuery } from "@/lib/search"

export function TagPicker({
  suggestions,
  defaultTags,
}: {
  suggestions: string[]
  defaultTags: string[]
}) {
  const [tags, setTags] = useState<string[]>(defaultTags)
  const [query, setQuery] = useState("")

  const trimmed = query.trim()
  const isNew =
    trimmed.length > 0 &&
    ![...suggestions, ...tags].some(
      (tag) => tag.toLowerCase() === trimmed.toLowerCase()
    )

  // Unlike an ingredient, a tag is not a row anywhere until the recipe is
  // saved, so creating one is local state and never a server round-trip.
  function add(tag: string) {
    setTags((current) => (current.includes(tag) ? current : [...current, tag]))
    setQuery("")
  }

  return (
    <>
      {/* What the action reads, through formData.getAll("tags"). The combobox's
          own input is unnamed, so a half-typed word never submits as a tag. */}
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}

      <Combobox
        autoComplete="off"
        multiple
        // In place of Base UI's own, which matches the query as a single
        // string. Here it mostly buys the partial word: «veget» finds
        // «vegetariano», which the collator filter would too — but a tag typed
        // as two words would have needed them adjacent, and now does not.
        filter={(tag: string, query: string) => matchesQuery(tag, query)}
        items={suggestions}
        value={tags}
        onValueChange={setTags}
        inputValue={query}
        onInputValueChange={setQuery}
      >
        <ComboboxChips>
          {tags.map((tag) => (
            <ComboboxChip key={tag}>{tag}</ComboboxChip>
          ))}
          <ComboboxChipsInput
            aria-label="Etichette"
            placeholder={tags.length === 0 ? "Etichette" : undefined}
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>
            {isNew ? (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                onClick={() => add(trimmed)}
              >
                Crea «{trimmed}»
              </button>
            ) : (
              "Nessuna etichetta."
            )}
          </ComboboxEmpty>
          <ComboboxList>
            {(tag: string) => (
              <ComboboxItem key={tag} value={tag}>
                {tag}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  )
}
