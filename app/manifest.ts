import type { MetadataRoute } from "next"

// Named for the shell, not for this module: finance and news will install to the
// same icon — design document §12. "Menù e spesa" is the title of one section.
//
// No `share_target` yet. It points at /import, which does not exist: declaring
// it now would put the app in Android's share sheet only to land on a 404.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Personal Productivity",
    short_name: "Productivity",
    description: "Menù settimanale e lista della spesa",
    lang: "it",
    dir: "ltr",
    scope: "/",
    start_url: "/menu",
    display: "standalone",
    background_color: "#1c1c17",
    theme_color: "#1c1c17",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
