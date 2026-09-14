import { describe, expect, it } from "vitest";
import { bumpSemanticVersion, validateModelRelease } from "../src/model-governance";

describe("model governance", () => {
  it("maps methodology changes to semantic-version rules", () => {
    expect(bumpSemanticVersion("1.0.0", "coefficients")).toBe("1.0.1");
    expect(bumpSemanticVersion("1.0.1", "validated_feature")).toBe("1.1.0");
    expect(bumpSemanticVersion("1.1.0", "architecture")).toBe("2.0.0");
  });

  it("requires reproducible release metadata", () => {
    expect(() => validateModelRelease({
      semanticVersion: "1.0.0",
      gitCommit: "abc123",
      methodologyHash: "not-a-hash",
      releasedAt: "2026-09-13T12:00:00Z",
      trainingCycles: [2020, 2022, 2024],
    })).toThrow(/methodologyHash/);
  });
});
