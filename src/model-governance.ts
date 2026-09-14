export type MethodologyChange = "coefficients" | "validated_feature" | "architecture";

export interface ModelRelease {
  semanticVersion: string;
  gitCommit: string;
  methodologyHash: string;
  releasedAt: string;
  trainingCycles: readonly number[];
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function bumpSemanticVersion(current: string, change: MethodologyChange): string {
  const match = VERSION.exec(current);
  if (!match) throw new Error("semantic version must have major.minor.patch form");
  const [major, minor, patch] = match.slice(1).map(Number);
  if (change === "architecture") return `${major + 1}.0.0`;
  if (change === "validated_feature") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function validateModelRelease(release: ModelRelease): void {
  if (!VERSION.test(release.semanticVersion)) throw new Error("model release requires a semantic version");
  if (!release.gitCommit.trim()) throw new Error("model release requires a git commit");
  if (!SHA256.test(release.methodologyHash)) throw new Error("methodologyHash must be a lowercase SHA-256 hex digest");
  if (!release.releasedAt || Number.isNaN(Date.parse(release.releasedAt))) throw new Error("model release requires a valid release timestamp");
  if (release.trainingCycles.length === 0 || release.trainingCycles.some((cycle) => !Number.isInteger(cycle) || cycle < 1900)) {
    throw new Error("model release requires valid training cycles");
  }
}
