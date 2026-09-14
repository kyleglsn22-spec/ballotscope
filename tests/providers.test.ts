import { describe, expect, it } from "vitest";
import { buildFecCandidatesUrl, normalizeFecCandidate } from "../src/providers/fec";
import { buildKalshiMarketsUrl, buildKalshiOrderbookUrl, buildPolymarketMarketsUrl, normalizeVenueMarketSnapshot } from "../src/providers/markets";
import { fetchJson } from "../src/providers/http";

describe("source provider boundaries", () => {
  it("builds FEC requests without embedding a key in source", () => {
    const url = new URL(buildFecCandidatesUrl({ apiKey: "runtime-key", cycle: 2026, page: 2 }));
    expect(url.pathname).toBe("/v1/candidates/");
    expect(url.searchParams.get("election_year")).toBe("2026");
    expect(url.searchParams.get("api_key")).toBe("runtime-key");
  });

  it("normalizes FEC identity fields into the canonical candidate shape", () => {
    expect(normalizeFecCandidate({ candidate_id: "H000001", name: "Synthetic Candidate", party_full: "Example Party", election_years: [2026] }, "2026-09-13T12:00:00Z")).toMatchObject({
      entityType: "candidate",
      externalId: "H000001",
      payload: { canonicalName: "Synthetic Candidate", party: "Example Party" },
    });
  });

  it("keeps venue URLs and market observations separate from model inputs", () => {
    expect(buildKalshiMarketsUrl({ status: "open", limit: 10 })).toContain("status=open");
    expect(buildKalshiOrderbookUrl("TICKER/1")).toContain("TICKER%2F1");
    expect(buildPolymarketMarketsUrl({ limit: 10 })).toContain("limit=10");
    expect(normalizeVenueMarketSnapshot({ venue: "Kalshi", externalId: "KX-1", observedAt: "2026-09-13T12:00:00Z", yesPrice: 0.55 }).payload).toMatchObject({ venue: "Kalshi", yesPrice: 0.55 });
  });

  it("bounds and parses provider responses", async () => {
    const response = await fetchJson<{ ok: boolean }>("https://provider.test/data", {
      fetcher: async () => new Response('{"ok":true}', { status: 200 }),
    });
    expect(response).toEqual({ ok: true });
    await expect(fetchJson("https://provider.test/data", {
      fetcher: async () => new Response("x".repeat(20), { status: 200 }),
      maxBytes: 10,
    })).rejects.toThrow(/byte limit/);
  });
});
