import worker from "../src/index";
import { describe, expect, it } from "vitest";

const env = { ENVIRONMENT: "test" };

describe("BallotScope API shell", () => {
  it("reports health", async () => {
    const response = await worker.fetch(new Request("https://example.test/health"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  it("does not expose unvalidated forecasts", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/v1/forecasts"), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "forecast_not_available",
      requiredEvidence: expect.arrayContaining(["input-bundle hash"]),
    });
  });

  it("exposes explicit source health states", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/v1/sources"), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { status: string; total: number; items: Array<{ status: string }> };
    expect(body).toMatchObject({ status: "not_ready", total: 6 });
    expect(body.items.every((source: { status: string }) => source.status === "unconfigured")).toBe(true);
  });

  it("returns an empty ledger instead of implying historical data", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/v1/ledger"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [], status: "not_ready" });
  });
});
