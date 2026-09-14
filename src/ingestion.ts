export type IngestEntityType = "candidate" | "poll" | "finance_snapshot" | "market_snapshot" | "jurisdiction";

export interface SourceManifest {
  sourceName: string;
  sourceType: string;
  parserVersion: string;
  license: string | null;
}

export interface NormalizedRecord {
  entityType: IngestEntityType;
  externalId: string;
  observedAt: string;
  payload: Record<string, unknown>;
}

export interface IngestBatch {
  manifest: SourceManifest;
  retrievedAt: string;
  rawDocument: {
    r2Key: string;
    sha256: string;
  };
  records: readonly NormalizedRecord[];
}

export interface DeduplicationResult {
  records: readonly NormalizedRecord[];
  duplicateExternalIds: readonly string[];
}

export interface PollObservationInput {
  externalId: string;
  raceExternalId: string;
  pollsterExternalId: string;
  startDate: string;
  endDate: string;
  population: string;
  sampleSize?: number | null;
  mode?: string | null;
  results: readonly { candidateExternalId: string; pct: number; undecidedPct?: number | null }[];
}

export interface MarketSnapshotInput {
  externalId: string;
  observedAt: string;
  yesPrice: number;
  bid?: number | null;
  ask?: number | null;
  liquidity?: number | null;
  volume?: number | null;
}

const SHA256 = /^[0-9a-f]{64}$/;

function requireNonEmpty(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is required`);
  return value;
}

function requireIsoDate(value: string, label: string): string {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid ISO timestamp/date`);
  return value;
}

function requireProbability(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
  return value;
}

function requirePercent(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100`);
  return value;
}

export function recordKey(record: Pick<NormalizedRecord, "entityType" | "externalId">): string {
  return `${record.entityType}:${requireNonEmpty(record.externalId, "externalId")}`;
}

export function deduplicateRecords(records: readonly NormalizedRecord[]): DeduplicationResult {
  const seen = new Map<string, NormalizedRecord>();
  const duplicateExternalIds: string[] = [];
  for (const record of records) {
    const key = recordKey(record);
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, record);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new Error(`conflicting duplicate record for ${key}`);
    }
    duplicateExternalIds.push(key);
  }
  return { records: [...seen.values()], duplicateExternalIds };
}

export function validateIngestBatch(batch: IngestBatch): void {
  requireNonEmpty(batch.manifest.sourceName, "sourceName");
  requireNonEmpty(batch.manifest.sourceType, "sourceType");
  requireNonEmpty(batch.manifest.parserVersion, "parserVersion");
  requireIsoDate(batch.retrievedAt, "retrievedAt");
  requireNonEmpty(batch.rawDocument.r2Key, "r2Key");
  if (!SHA256.test(batch.rawDocument.sha256)) throw new Error("raw document sha256 must be a lowercase SHA-256 hex digest");
  for (const record of batch.records) {
    requireNonEmpty(record.entityType, "entityType");
    requireNonEmpty(record.externalId, "externalId");
    requireIsoDate(record.observedAt, "observedAt");
  }
  deduplicateRecords(batch.records);
}

export function normalizePollObservation(input: PollObservationInput): NormalizedRecord {
  requireNonEmpty(input.externalId, "poll externalId");
  requireNonEmpty(input.raceExternalId, "raceExternalId");
  requireNonEmpty(input.pollsterExternalId, "pollsterExternalId");
  requireIsoDate(input.startDate, "startDate");
  requireIsoDate(input.endDate, "endDate");
  if (Date.parse(input.endDate) < Date.parse(input.startDate)) throw new Error("poll endDate must not precede startDate");
  requireNonEmpty(input.population, "population");
  if (input.sampleSize !== undefined && input.sampleSize !== null && (!Number.isInteger(input.sampleSize) || input.sampleSize <= 0)) {
    throw new Error("sampleSize must be a positive integer");
  }
  if (input.results.length === 0) throw new Error("poll must contain at least one candidate result");
  const results = input.results.map((result) => ({
    candidateExternalId: requireNonEmpty(result.candidateExternalId, "candidateExternalId"),
    pct: requirePercent(result.pct, "candidate pct"),
    undecidedPct: result.undecidedPct === undefined || result.undecidedPct === null ? null : requirePercent(result.undecidedPct, "undecided pct"),
  }));
  return {
    entityType: "poll",
    externalId: input.externalId,
    observedAt: input.endDate,
    payload: {
      raceExternalId: input.raceExternalId,
      pollsterExternalId: input.pollsterExternalId,
      startDate: input.startDate,
      endDate: input.endDate,
      population: input.population,
      sampleSize: input.sampleSize ?? null,
      mode: input.mode ?? null,
      results,
    },
  };
}

export function normalizeMarketSnapshot(input: MarketSnapshotInput): NormalizedRecord {
  requireNonEmpty(input.externalId, "market externalId");
  requireIsoDate(input.observedAt, "observedAt");
  const yesPrice = requireProbability(input.yesPrice, "yesPrice");
  const bid = input.bid === undefined || input.bid === null ? null : requireProbability(input.bid, "bid");
  const ask = input.ask === undefined || input.ask === null ? null : requireProbability(input.ask, "ask");
  if (bid !== null && ask !== null && bid > ask) throw new Error("market bid cannot exceed ask");
  const spread = bid !== null && ask !== null ? Number((ask - bid).toFixed(10)) : null;
  const nonNegative = (value: number | null | undefined, label: string): number | null => {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative`);
    return value;
  };
  return {
    entityType: "market_snapshot",
    externalId: input.externalId,
    observedAt: input.observedAt,
    payload: {
      yesPrice,
      bid,
      ask,
      spread,
      liquidity: nonNegative(input.liquidity, "liquidity"),
      volume: nonNegative(input.volume, "volume"),
    },
  };
}
