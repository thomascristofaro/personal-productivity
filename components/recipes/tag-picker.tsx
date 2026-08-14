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
        multiple
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
                className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
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
