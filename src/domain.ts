export type ForecastStatus = "not_ready" | "ready" | "stale";

export type SourceType =
  | "polling"
  | "campaign_finance"
  | "geography"
  | "historical_results"
  | "prediction_market";

export type SourceHealthStatus = "unconfigured" | "current" | "stale" | "error";

export interface SourceHealth {
  name: string;
  sourceType: SourceType;
  url: string;
  status: SourceHealthStatus;
  expectedCadence: string;
  lastSuccessfulFetch: string | null;
  rowsReceived: number | null;
  parserVersion: string | null;
  note: string;
}

export interface AdapterStatus {
  name: string;
  sourceType: SourceType;
  status: "scaffold" | "configured" | "disabled";
  authentication: "none" | "secret" | "license_review";
  note: string;
}

export interface ApiMeta {
  name: "BallotScope";
  apiVersion: "v1";
  environment: string;
  forecastStatus: ForecastStatus;
  currentModelVersion: string | null;
  constitutionalRules: readonly string[];
}

export interface EmptyCollection<T> {
  items: readonly T[];
  total: number;
  status: "not_ready" | "ready";
  message: string;
}

export interface RaceSummary {
  id: string;
  slug: string;
  label: string;
  office: "House" | "Senate";
  state: string;
  status: "unconfigured" | "ready";
}

export interface ForecastUnavailable {
  error: "forecast_not_available";
  message: string;
  requiredEvidence: readonly string[];
}

export const CONSTITUTIONAL_RULES = [
  "A probability requires a timestamp and model version.",
  "Historical forecasts are append-only and corrections remain visible.",
  "AI may explain structured output but cannot alter a probability.",
  "Prediction-market prices remain separate comparison signals.",
  "Material forecast movement requires a quantitative attribution record.",
  "Uncertainty intervals are published with point estimates.",
] as const;

export const SOURCE_REGISTRY: readonly SourceHealth[] = [
  {
    name: "VoteHub",
    sourceType: "polling",
    url: "https://example.invalid/votehub",
    status: "unconfigured",
    expectedCadence: "frequent",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "Adapter and license verification are not configured in this environment.",
  },
  {
    name: "OpenFEC",
    sourceType: "campaign_finance",
    url: "https://api.open.fec.gov/",
    status: "unconfigured",
    expectedCadence: "nightly",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "API key and source adapter are intentionally absent from source control.",
  },
  {
    name: "U.S. Census Bureau",
    sourceType: "geography",
    url: "https://www.census.gov/geographies/mapping-files.html",
    status: "unconfigured",
    expectedCadence: "versioned reference",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "2026 boundary ingestion and crosswalk audit remain a build task.",
  },
  {
    name: "MIT Election Data and Science Lab",
    sourceType: "historical_results",
    url: "https://electionlab.mit.edu/",
    status: "unconfigured",
    expectedCadence: "versioned reference",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "Historical dataset download and licensing review remain a build task.",
  },
  {
    name: "Kalshi",
    sourceType: "prediction_market",
    url: "https://kalshi.com/",
    status: "unconfigured",
    expectedCadence: "every few minutes",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "Market snapshots are not model inputs.",
  },
  {
    name: "Polymarket",
    sourceType: "prediction_market",
    url: "https://polymarket.com/",
    status: "unconfigured",
    expectedCadence: "every few minutes",
    lastSuccessfulFetch: null,
    rowsReceived: null,
    parserVersion: null,
    note: "Market snapshots are not model inputs.",
  },
] as const;

export const ADAPTER_REGISTRY: readonly AdapterStatus[] = [
  { name: "VoteHub polling adapter", sourceType: "polling", status: "scaffold", authentication: "license_review", note: "Requires endpoint/schema confirmation and attribution review before activation." },
  { name: "OpenFEC adapter", sourceType: "campaign_finance", status: "scaffold", authentication: "secret", note: "Requires a runtime FEC API key; no key is stored in this repository." },
  { name: "Census geography adapter", sourceType: "geography", status: "scaffold", authentication: "none", note: "Requires versioned 120th-Congress boundary ingestion and audit." },
  { name: "MEDSL historical-results adapter", sourceType: "historical_results", status: "scaffold", authentication: "license_review", note: "Requires dataset version and license verification." },
  { name: "Kalshi market adapter", sourceType: "prediction_market", status: "scaffold", authentication: "none", note: "Public market data is comparison-only and never a model input." },
  { name: "Polymarket market adapter", sourceType: "prediction_market", status: "scaffold", authentication: "none", note: "Public market data is comparison-only and never a model input." },
] as const;
