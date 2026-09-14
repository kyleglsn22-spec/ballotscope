import { describe, expect, it } from "vitest";
import { deduplicateRecords, normalizeMarketSnapshot, normalizePollObservation, validateIngestBatch } from "../src/ingestion";

describe("ingestion contracts", () => {
  it("deduplicates identical records but rejects conflicting duplicates", () => {
    const record = { entityType: "candidate" as const, externalId: "candidate-1", observedAt: "2026-09-13", payload: { name: "Synthetic" } };
    expect(deduplicateRecords([record, record])).toMatchObject({ duplicateExternalIds: ["candidate:candidate-1"] });
    expect(() => deduplicateRecords([record, { ...record, payload: { name: "Different" } }])).toThrow(/conflicting duplicate/);
  });

  it("normalizes poll evidence without changing raw percentages", () => {
    const normalized = normalizePollObservation({
      externalId: "poll-1",
      raceExternalId: "race-1",
      pollsterExternalId: "pollster-1",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      population: "LV",
      sampleSize: 800,
      mode: "online",
      results: [{ candidateExternalId: "candidate-1", pct: 51.2, undecidedPct: 4.1 }],
    });
    expect(normalized.payload).toMatchObject({ raceExternalId: "race-1", results: [{ pct: 51.2 }] });
  });

  it("keeps market data separate and validates bid/ask", () => {
    expect(normalizeMarketSnapshot({ externalId: "market-1", observedAt: "2026-09-13T12:00:00Z", yesPrice: 0.62, bid: 0.6, ask: 0.64 })).toMatchObject({
      entityType: "market_snapshot",
      payload: { spread: 0.04 },
    });
    expect(() => normalizeMarketSnapshot({ externalId: "market-1", observedAt: "2026-09-13T12:00:00Z", yesPrice: 0.62, bid: 0.7, ask: 0.64 })).toThrow(/bid cannot exceed ask/);
  });

  it("requires raw archive provenance before a batch is accepted", () => {
    expect(() => validateIngestBatch({
      manifest: { sourceName: "Synthetic", sourceType: "polling", parserVersion: "0.1.0", license: null },
      retrievedAt: "2026-09-13T12:00:00Z",
      rawDocument: { r2Key: "synthetic/one.json", sha256: "not-a-hash" },
      records: [],
    })).toThrow(/SHA-256/);
  });
});
