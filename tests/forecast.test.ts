import { describe, expect, it } from "vitest";
import { assertValidForecastEnvelope, attributeMovement, quantile, summarizeSimulation } from "../src/forecast";
import { evaluateSourceHealth } from "../src/reliability";

describe("forecast math", () => {
  it("calculates deterministic quantiles without mutating input", () => {
    const values = [5, 1, 9, 3];
    expect(quantile(values, 0.5)).toBe(4);
    expect(values).toEqual([5, 1, 9, 3]);
  });

  it("summarizes simulation margins with win probability and intervals", () => {
    const summary = summarizeSimulation([-3, -1, 1, 3], 0);
    expect(summary.mean).toBe(0);
    expect(summary.winProbability).toBe(0.5);
    expect(summary.intervals.p95.low).toBeLessThan(summary.intervals.p95.high);
  });

  it("requires attribution to reconcile", () => {
    expect(attributeMovement(5.3, [
      { factor: "polling", contributionPp: 2.4 },
      { factor: "national", contributionPp: 1.6 },
      { factor: "finance", contributionPp: 0.8 },
      { factor: "interaction", contributionPp: 0.5 },
    ])).toMatchObject({ deltaPp: 5.3, residualPp: 0 });
    expect(() => attributeMovement(5, [{ factor: "polling", contributionPp: 4 }])).toThrow(/does not reconcile/);
  });

  it("rejects forecasts without reproducibility metadata", () => {
    expect(() => assertValidForecastEnvelope({
      observedAt: "",
      modelVersion: "1.0.0",
      inputBundleHash: "hash",
      winProbability: 0.5,
      intervals: { p50: { low: -1, high: 1 }, p80: { low: -2, high: 2 }, p95: { low: -3, high: 3 } },
    })).toThrow(/timestamp/);
  });

  it("marks sources stale instead of silently treating old data as current", () => {
    expect(evaluateSourceHealth({
      lastSuccessfulFetch: "2026-09-13T00:00:00.000Z",
      now: "2026-09-13T02:01:00.000Z",
      expectedCadenceSeconds: 3600,
    })).toMatchObject({ status: "stale", ageSeconds: 7260 });
  });
});
