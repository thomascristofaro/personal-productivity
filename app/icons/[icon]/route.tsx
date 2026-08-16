import { ImageResponse } from "next/og"

// Generated at build time, not per request: the icons never change between
// deployments, and Android fetches them while installing the WebAPK.
export const dynamic = "force-static"
export const dynamicParams = false

// The one place in the app where a colour is written out rather than taken from
// a theme token: a manifest icon is a PNG, so it cannot read a CSS variable.
// These two are `--card` and `--primary` of the dark theme, in hex.
const BACKGROUND = "#1c1c17"
const MONOGRAM = "#7cd100"

// `maskable` is cropped to a circle by Android, so its glyph gets more room
// around it. See docs/conventions/ui.md.
const ICONS: Record<string, { size: number; inset: number }> = {
  "icon-192.png": { size: 192, inset: 0.2 },
  "icon-512.png": { size: 512, inset: 0.2 },
  "icon-maskable-512.png": { size: 512, inset: 0.32 },
  "apple-icon-180.png": { size: 180, inset: 0.2 },
}

export function generateStaticParams() {
  return Object.keys(ICONS).map((icon) => ({ icon }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> }
) {
  const { icon } = await params
  const spec = ICONS[icon]

  if (spec === undefined) {
    return new Response("Not found", { status: 404 })
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BACKGROUND,
        color: MONOGRAM,
        fontSize: spec.size * (1 - spec.inset * 2),
        lineHeight: 1,
      }}
    >
      P
    </div>,
    { width: spec.size, height: spec.size }
  )
}
