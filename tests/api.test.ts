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
    expect(await response.json()).toMatchObject({ error: "forecast_not_available" });
  });
});
