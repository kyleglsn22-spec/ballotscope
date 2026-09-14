export interface Interval {
  low: number;
  high: number;
}

export interface SimulationSummary {
  mean: number;
  winProbability: number;
  intervals: {
    p50: Interval;
    p80: Interval;
    p95: Interval;
  };
}

export interface AttributionInput {
  factor: string;
  contributionPp: number;
}

export interface AttributionResult {
  deltaPp: number;
  contributions: readonly AttributionInput[];
  residualPp: number;
}

export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) throw new Error("probability must be finite");
  return Math.min(1, Math.max(0, value));
}

export function quantile(values: readonly number[], probability: number): number {
  if (values.length === 0) throw new Error("cannot calculate a quantile from no samples");
  if (probability < 0 || probability > 1) throw new Error("quantile probability must be between 0 and 1");
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function centralInterval(values: readonly number[], level: number): Interval {
  const tail = (1 - level) / 2;
  return { low: quantile(values, tail), high: quantile(values, 1 - tail) };
}

export function summarizeSimulation(margins: readonly number[], winThreshold = 0): SimulationSummary {
  if (margins.length === 0) throw new Error("cannot summarize an empty simulation");
  return {
    mean: margins.reduce((sum, value) => sum + value, 0) / margins.length,
    winProbability: margins.filter((margin) => margin > winThreshold).length / margins.length,
    intervals: {
      p50: centralInterval(margins, 0.5),
      p80: centralInterval(margins, 0.8),
      p95: centralInterval(margins, 0.95),
    },
  };
}

export function attributeMovement(deltaPp: number, inputs: readonly AttributionInput[], tolerancePp = 0.001): AttributionResult {
  if (!Number.isFinite(deltaPp)) throw new Error("movement must be finite");
  if (inputs.some((input) => !input.factor || !Number.isFinite(input.contributionPp))) {
    throw new Error("attribution factors must have names and finite contributions");
  }
  const contributionTotal = inputs.reduce((sum, input) => sum + input.contributionPp, 0);
  const residualPp = deltaPp - contributionTotal;
  if (Math.abs(residualPp) > tolerancePp) {
    throw new Error(`attribution does not reconcile: residual ${residualPp}pp exceeds ${tolerancePp}pp`);
  }
  return { deltaPp, contributions: inputs, residualPp };
}

export function assertValidForecastEnvelope(input: {
  observedAt: string;
  modelVersion: string;
  inputBundleHash: string;
  winProbability: number;
  intervals: { p50: Interval; p80: Interval; p95: Interval };
}): void {
  if (!input.observedAt || Number.isNaN(Date.parse(input.observedAt))) throw new Error("forecast requires a valid timestamp");
  if (!input.modelVersion) throw new Error("forecast requires a model version");
  if (!input.inputBundleHash) throw new Error("forecast requires an input bundle hash");
  const probability = clampProbability(input.winProbability);
  if (probability !== input.winProbability) throw new Error("win probability must be normalized between 0 and 1");
  for (const [name, interval] of Object.entries(input.intervals)) {
    if (!Number.isFinite(interval.low) || !Number.isFinite(interval.high) || interval.low > interval.high) {
      throw new Error(`${name} interval is invalid`);
    }
  }
}
