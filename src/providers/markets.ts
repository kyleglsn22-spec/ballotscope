import { normalizeMarketSnapshot, type NormalizedRecord } from "../ingestion";

export const KALSHI_API_BASE = "https://external-api.kalshi.com/trade-api/v2";
export const POLYMARKET_GAMMA_BASE = "https://gamma-api.polymarket.com";

export function buildKalshiMarketsUrl(options: { status?: string; limit?: number; cursor?: string } = {}): string {
  const url = new URL(`${KALSHI_API_BASE}/markets`);
  if (options.status) url.searchParams.set("status", options.status);
  if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
  if (options.cursor) url.searchParams.set("cursor", options.cursor);
  return url.toString();
}

export function buildKalshiOrderbookUrl(ticker: string): string {
  if (!ticker.trim()) throw new Error("Kalshi ticker is required");
  return `${KALSHI_API_BASE}/markets/${encodeURIComponent(ticker)}/orderbook`;
}

export function buildPolymarketMarketsUrl(options: { limit?: number; offset?: number } = {}): string {
  const url = new URL(`${POLYMARKET_GAMMA_BASE}/markets`);
  if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
  if (options.offset !== undefined) url.searchParams.set("offset", String(options.offset));
  return url.toString();
}

export function normalizeVenueMarketSnapshot(input: {
  venue: "Kalshi" | "Polymarket";
  externalId: string;
  observedAt: string;
  yesPrice: number;
  bid?: number | null;
  ask?: number | null;
  liquidity?: number | null;
  volume?: number | null;
}): NormalizedRecord {
  const normalized = normalizeMarketSnapshot(input);
  return {
    ...normalized,
    payload: { venue: input.venue, ...normalized.payload },
  };
}
