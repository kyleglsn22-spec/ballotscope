import {
  CONSTITUTIONAL_RULES,
  SOURCE_REGISTRY,
  type ApiMeta,
  type EmptyCollection,
  type ForecastUnavailable,
  type RaceSummary,
  type SourceHealth,
} from "./domain";

type RuntimeEnv = { ENVIRONMENT: string } & Partial<Pick<Env, "ASSETS">>;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const notReadyMessage = "No audited model run is configured for this environment.";

function meta(env: RuntimeEnv): ApiMeta {
  return {
    name: "BallotScope",
    apiVersion: "v1",
    environment: env.ENVIRONMENT,
    forecastStatus: "not_ready",
    currentModelVersion: null,
    constitutionalRules: CONSTITUTIONAL_RULES,
  };
}

function emptyCollection<T>(message: string): EmptyCollection<T> {
  return { items: [], total: 0, status: "not_ready", message };
}

function sources(): EmptyCollection<SourceHealth> {
  return {
    items: SOURCE_REGISTRY,
    total: SOURCE_REGISTRY.length,
    status: "not_ready",
    message: "Source adapters are not configured; no live data is represented.",
  };
}

function unavailable(): ForecastUnavailable {
  return {
    error: "forecast_not_available",
    message: notReadyMessage,
    requiredEvidence: [
      "validated source ingestion",
      "versioned model release",
      "input-bundle hash",
      "cycle-held-out evaluation",
    ],
  };
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    if (url.pathname === "/health") {
      return json({ status: "ok", service: "ballotscope-api", environment: env.ENVIRONMENT });
    }

    if (url.pathname === "/api/v1/meta") {
      return json(meta(env));
    }

    if (url.pathname === "/api/v1/sources") {
      return json(sources());
    }

    if (url.pathname === "/api/v1/races") {
      return json(emptyCollection<RaceSummary>("Canonical races are not loaded in this environment."));
    }

    if (url.pathname === "/api/v1/ledger") {
      return json(emptyCollection("No immutable forecast runs are configured in this environment."));
    }

    if (url.pathname === "/api/v1/forecasts") {
      return json(unavailable(), 503);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "not_found" }, 404);
  },
};
