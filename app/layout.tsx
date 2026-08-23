import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// The app's name, not a module's. "Menù e spesa" was right when there was one
// module; it is now the name of one of two, and a finance page falling back to
// it would be wrong. app/manifest.ts had already written down why.
export const metadata: Metadata = {
  title: "Personal Productivity",
  description: "Menù, spesa e finanze personali",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-icon-180.png",
  },
}

// `viewportFit: "cover"` is what makes env(safe-area-inset-*) report anything
// other than zero, so the insets the app layout applies depend on it. No
// maximum-scale and no user-scalable: pinch zoom stays available.
//
// themeColor is per scheme because the manifest's is a single static value:
// this is what keeps the system bars matching the theme actually on screen.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c09" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
