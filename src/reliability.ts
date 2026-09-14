export type HealthStatus = "unconfigured" | "current" | "stale" | "error";

export interface HealthInput {
  lastSuccessfulFetch: string | null;
  expectedCadenceSeconds: number;
  now?: string;
  failure?: boolean;
}

export interface HealthResult {
  status: HealthStatus;
  ageSeconds: number | null;
  staleAfterSeconds: number;
}

export function evaluateSourceHealth(input: HealthInput): HealthResult {
  if (!Number.isFinite(input.expectedCadenceSeconds) || input.expectedCadenceSeconds <= 0) {
    throw new Error("expected cadence must be a positive number of seconds");
  }
  const staleAfterSeconds = input.expectedCadenceSeconds * 2;
  if (input.failure) return { status: "error", ageSeconds: null, staleAfterSeconds };
  if (!input.lastSuccessfulFetch) return { status: "unconfigured", ageSeconds: null, staleAfterSeconds };
  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  const fetchedMs = Date.parse(input.lastSuccessfulFetch);
  if (Number.isNaN(nowMs) || Number.isNaN(fetchedMs)) throw new Error("health timestamps must be valid ISO timestamps");
  const ageSeconds = Math.max(0, (nowMs - fetchedMs) / 1000);
  return {
    status: ageSeconds > staleAfterSeconds ? "stale" : "current",
    ageSeconds,
    staleAfterSeconds,
  };
}
