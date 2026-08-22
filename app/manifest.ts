import type { MetadataRoute } from "next"

// Named for the shell, not for this module: finance and news will install to the
// same icon — design document §12. "Menù e spesa" is the title of one section.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Personal Productivity",
    short_name: "Productivity",
    description: "Menù, spesa e finanze personali",
    lang: "it",
    dir: "ltr",
    scope: "/",
    // The fork, not a module. With one module it redirects onwards by itself,
    // so this stays right whichever modules a person can see.
    start_url: "/",
    // All three params, because Android's share intent puts the link in
    // EXTRA_TEXT: Chrome fills `text` and leaves `url` empty. /import reads
    // both — see the import design document §6.
    share_target: {
      action: "/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
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
