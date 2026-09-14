import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/archive";

describe("raw archive utilities", () => {
  it("creates a stable SHA-256 content address", async () => {
    await expect(sha256Hex(new TextEncoder().encode("ballotscope"))).resolves.toBe(
      "b8c08c3ea93e0d88b2eee16d2de94aab3861a6c53e0b9b9df5996b0aadbdf45b",
    );
  });
});
