// The list of cards, and nothing else. `ListSection` holds lines of text and
// packs them tight; a list of DataListRow cards needs air between them, and
// before this each screen holding a fixed list of cards wrote the gap itself.
export function CardList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>
}

// `renderItem` is a render prop, which is the right call here rather than a
// lapse: the parent supplies the data the child renders, the case
// vercel-composition-patterns names as appropriate for them.
export function DataList<Item>({
  items,
  renderItem,
  announcement,
  empty,
}: {
  items: readonly Item[]
  renderItem: (item: Item) => React.ReactNode
  announcement: string
  empty: React.ReactNode
}) {
  return (
    <div>
      {/* Announces the count only. A live region wrapping the rows would queue
          the whole list's contents on every debounced keystroke. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {items.length === 0 ? (
        empty
      ) : (
        <CardList>
          {/* Called with one argument, so the callback never silently receives
              an index and an array it did not declare. */}
          {items.map((item) => renderItem(item))}
        </CardList>
      )}
    </div>
  )
}
