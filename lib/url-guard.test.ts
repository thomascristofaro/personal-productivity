import { afterEach, describe, expect, it, vi } from "vitest"

import {
  BlockedUrlError,
  fetchPublicPage,
  isPrivateAddress,
} from "@/lib/url-guard"

// Hoisted above the import by Vitest, so the module under test sees the stub.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "public.example") return [{ address: "93.184.216.34" }]
    if (hostname === "internal.example") return [{ address: "10.0.0.5" }]
    throw new Error(`unexpected lookup: ${hostname}`)
  }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and multicast", () => {
    for (const address of [
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "239.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }
  })

  it("blocks an IPv4 address wearing an IPv6 coat", () => {
    // ::ffff:169.254.169.254 reaches the cloud metadata endpoint just as well
    // as the dotted form does.
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true)
  })

  it("allows a public address", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false)
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false)
  })

  it("blocks anything that is not an address", () => {
    expect(isPrivateAddress("not-an-address")).toBe(true)
  })
})

describe("fetchPublicPage", () => {
  it("refuses a scheme that is not http or https", async () => {
    await expect(fetchPublicPage("file:///etc/passwd")).rejects.toBeInstanceOf(
      BlockedUrlError
    )
  })

  it("refuses a host that resolves to a private address", async () => {
    await expect(
      fetchPublicPage("https://internal.example/page")
    ).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it("refuses a public host that redirects to a private one", async () => {
    // The reason redirects are followed by hand: a host that passes the check
    // and then sends us to 10.0.0.5 is exactly the attack the guard exists for.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://internal.example/secret" },
          })
      )
    )

    await expect(
      fetchPublicPage("https://public.example/page")
    ).rejects.toBeInstanceOf(BlockedUrlError)
  })

  it("returns the body of a page it is allowed to read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>ciao</html>", { status: 200 }))
    )

    await expect(fetchPublicPage("https://public.example/page")).resolves.toBe(
      "<html>ciao</html>"
    )
  })
})
