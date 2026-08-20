import { Buffer } from "node:buffer"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_REDIRECTS = 3
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000

// Some sites answer a bare client with a challenge page. Naming a real browser
// is not evasion — it is asking for the page a person would have been served.
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlockedUrlError"
  }
}

/**
 * Whether an IP address is one this application must not fetch from.
 *
 * Anything unrecognised counts as private. A guard that fails open is not a
 * guard, and the cost of a false refusal here is one page not importing.
 *
 * @param address - a dotted-quad or IPv6 address
 * @returns true when the address is private, loopback, link-local, reserved, or
 *   not an address at all
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)

  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    // Carrier-grade NAT, and everything from multicast upward.
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }

  if (version === 6) {
    const normalised = address.toLowerCase()
    if (normalised === "::1" || normalised === "::") return true
    // fc00::/7 unique-local, fe80::/10 link-local.
    if (/^f[cd]/.test(normalised)) return true
    if (normalised.startsWith("fe80")) return true

    // ::ffff:10.0.0.1 reaches the same host the dotted form does.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised)
    if (mapped !== null) return isPrivateAddress(mapped[1])

    return false
  }

  return true
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`scheme ${url.protocol} is not allowed`)
  }

  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true })

  if (addresses.length === 0) {
    throw new BlockedUrlError(`${host} does not resolve`)
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedUrlError(`${host} resolves to a private address`)
    }
  }
}

async function readCapped(response: Response): Promise<string> {
  if (response.body === null) return ""

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    size += value.byteLength
    // Stop rather than read on: a response that keeps arriving is not a page we
    // want, and the cap is what keeps it out of the function's memory.
    if (size > MAX_BYTES) {
      await reader.cancel()
      break
    }

    chunks.push(value)
  }

  return new TextDecoder("utf-8").decode(Buffer.concat(chunks))
}

/**
 * Fetches a page the user asked us to read, refusing what a fetcher must not
 * reach.
 *
 * Redirects are followed by hand so every hop is checked: a public host that
 * answers 302 to 169.254.169.254 is the whole reason this exists. The body is
 * never returned to a client — only the draft mapped from it leaves the server.
 *
 * @param rawUrl - the address, already validated as a URL by the caller
 * @returns the page's markup
 * @throws BlockedUrlError when the scheme, the host or the redirect chain is
 *   refused, or the upstream answers an error status
 */
export async function fetchPublicPage(rawUrl: string): Promise<string> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError("not a URL")
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublic(url)

      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (location === null) {
          throw new BlockedUrlError("redirect without a location")
        }
        url = new URL(location, url)
        continue
      }

      if (!response.ok) {
        throw new BlockedUrlError(`upstream answered ${response.status}`)
      }

      return await readCapped(response)
    }

    throw new BlockedUrlError("too many redirects")
  } finally {
    clearTimeout(timer)
  }
}
