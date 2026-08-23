import { DetailSection } from "@/components/page/section"

// The section, not a list of sections: two callers map over aisle groups and a
// third has a single section with a fixed title. A component taking the groups
// would force that third one to pass an array of one.
//
// The heading itself lives in DetailSection, so a detail screen that wants the
// same heading over something that is not a list does not copy it.
export function ListSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <DetailSection title={title} className={className}>
      <ul className="flex flex-col">{children}</ul>
    </DetailSection>
  )
}
