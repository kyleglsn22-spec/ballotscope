export interface RawArchiveMetadata {
  contentType?: string;
  sourceName: string;
  retrievedAt: string;
}

export interface RawArchiveResult {
  key: string;
  sha256: string;
  byteLength: number;
}

export async function sha256Hex(payload: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function archiveRawPayload(
  bucket: R2Bucket,
  key: string,
  payload: ArrayBuffer | Uint8Array,
  metadata: RawArchiveMetadata,
): Promise<RawArchiveResult> {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const sha256 = await sha256Hex(bytes);
  await bucket.put(key, bytes, {
    httpMetadata: metadata.contentType ? { contentType: metadata.contentType } : undefined,
    customMetadata: {
      sourceName: metadata.sourceName,
      retrievedAt: metadata.retrievedAt,
      sha256,
    },
  });
  return { key, sha256, byteLength: bytes.byteLength };
}
