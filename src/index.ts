export interface Env {
  ENVIRONMENT: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    if (url.pathname === "/health") {
      return json({ status: "ok", service: "ballotscope-api", environment: env.ENVIRONMENT });
    }

    if (url.pathname === "/api/v1/meta") {
      return json({ name: "BallotScope", apiVersion: "v1", forecastStatus: "not_ready" });
    }

    if (url.pathname === "/api/v1/forecasts") {
      return json({
        error: "forecast_not_available",
        message: "No audited model run is configured for this environment.",
      }, 503);
    }

    return json({ error: "not_found" }, 404);
  },
};
