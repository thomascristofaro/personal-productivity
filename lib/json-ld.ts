export type JsonLdNode = Record<string, unknown>

const BLOCK =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

// Real pages publish JSON-LD that JSON.parse refuses. The captured page in
// lib/__fixtures__/ puts raw newlines inside string literals, and it is the page
// the owners actually share — a strict reader would find nothing on it.
// Escaping only the control characters that sit inside a string literal is a
// repair narrow enough to be safe: outside a string they are whitespace, and
// JSON gives them no other meaning.
function escapeControlsInStrings(text: string): string {
  let out = ""
  let inString = false
  let escaped = false

  for (const character of text) {
    if (escaped) {
      out += character
      escaped = false
      continue
    }
    if (character === "\\") {
      out += character
      escaped = true
      continue
    }
    if (character === '"') {
      inString = !inString
      out += character
      continue
    }
    if (inString && character === "\n") {
      out += "\\n"
      continue
    }
    if (inString && character === "\r") {
      out += "\\r"
      continue
    }
    if (inString && character === "\t") {
      out += "\\t"
      continue
    }
    out += character
  }

  return out
}

function collect(value: unknown, into: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into)
    return
  }
  if (value === null || typeof value !== "object") return

  const node = value as JsonLdNode
  into.push(node)

  // Sites built on Yoast and its imitators put every real node under @graph and
  // leave nothing at the top level.
  if (Array.isArray(node["@graph"])) collect(node["@graph"], into)
}

/**
 * Every JSON-LD object a page publishes, flattened.
 *
 * @param html - the page's markup
 * @returns the nodes in declaration order; empty when there are none, or none
 *   that can be read
 */
export function readJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = []

  for (const match of html.matchAll(BLOCK)) {
    let parsed: unknown

    try {
      parsed = JSON.parse(match[1])
    } catch {
      try {
        parsed = JSON.parse(escapeControlsInStrings(match[1]))
      } catch {
        // One unreadable block must not cost a page the others it published.
        continue
      }
    }

    collect(parsed, nodes)
  }

  return nodes
}

/**
 * The schema.org Recipe among a page's JSON-LD nodes.
 *
 * @param nodes - what `readJsonLd` returned
 * @returns the first Recipe node, or null when the page declares none
 */
export function findRecipe(nodes: JsonLdNode[]): JsonLdNode | null {
  return (
    nodes.find((node) => {
      const type = node["@type"]
      if (typeof type === "string") return type === "Recipe"
      return Array.isArray(type) && type.includes("Recipe")
    }) ?? null
  )
}
