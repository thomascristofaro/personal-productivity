import { Toaster } from "@/components/ui/sonner"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-24">
      {children}
      <Toaster position="top-center" />
    </div>
  )
}
