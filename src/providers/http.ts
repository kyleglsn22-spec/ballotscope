export interface JsonRequestOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
  maxBytes?: number;
  fetcher?: typeof fetch;
}

const DEFAULT_MAX_BYTES = 2_000_000;

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("response exceeds configured byte limit");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("response exceeds configured byte limit");
      throw new Error("response exceeds configured byte limit");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(url, {
    method: "GET",
    headers: { accept: "application/json", ...options.headers },
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`source request failed with HTTP ${response.status}`);
  const text = await readBoundedText(response, options.maxBytes ?? DEFAULT_MAX_BYTES);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("source response was not valid JSON");
  }
}
