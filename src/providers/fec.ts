import { normalizePollObservation, type NormalizedRecord } from "../ingestion";
import { fetchJson, type JsonRequestOptions } from "./http";

export const FEC_API_BASE = "https://api.open.fec.gov/v1";

export interface FecCandidateApiRecord {
  candidate_id?: string;
  name?: string;
  party_full?: string | null;
  election_years?: readonly number[];
}

export interface FecCollection<T> {
  results: readonly T[];
}

export interface FecCandidatesRequest {
  apiKey: string;
  cycle: number;
  page?: number;
  perPage?: number;
}

export function buildFecCandidatesUrl(request: FecCandidatesRequest): string {
  if (!request.apiKey.trim()) throw new Error("FEC API key is required at the call boundary");
  if (!Number.isInteger(request.cycle) || request.cycle < 1900) throw new Error("FEC cycle must be a valid election year");
  const url = new URL(`${FEC_API_BASE}/candidates/`);
  url.searchParams.set("api_key", request.apiKey);
  url.searchParams.set("election_year", String(request.cycle));
  url.searchParams.set("page", String(request.page ?? 1));
  url.searchParams.set("per_page", String(request.perPage ?? 100));
  return url.toString();
}

export function normalizeFecCandidate(record: FecCandidateApiRecord, observedAt: string): NormalizedRecord {
  if (!record.candidate_id?.trim()) throw new Error("FEC candidate is missing candidate_id");
  if (!record.name?.trim()) throw new Error(`FEC candidate ${record.candidate_id} is missing name`);
  if (!observedAt || Number.isNaN(Date.parse(observedAt))) throw new Error("FEC observedAt must be a valid timestamp");
  return {
    entityType: "candidate",
    externalId: record.candidate_id,
    observedAt,
    payload: {
      canonicalName: record.name.trim(),
      party: record.party_full?.trim() || null,
      electionYears: record.election_years ?? [],
    },
  };
}

export async function fetchFecCandidates(
  request: FecCandidatesRequest,
  observedAt: string,
  options: Omit<JsonRequestOptions, "headers"> = {},
): Promise<readonly NormalizedRecord[]> {
  const response = await fetchJson<FecCollection<FecCandidateApiRecord>>(buildFecCandidatesUrl(request), options);
  return response.results.map((record) => normalizeFecCandidate(record, observedAt));
}
