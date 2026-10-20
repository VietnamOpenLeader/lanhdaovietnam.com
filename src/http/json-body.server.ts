import { ContentError } from "../core/errors";

export const maxContentRequestBytes = 216_384;

export async function readJsonBody(
  request: Request,
  maxBytes = maxContentRequestBytes,
): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new ContentError({ status: 400, code: "VALIDATION" });
    }
    if (declaredLength > maxBytes) {
      throw new ContentError({ status: 413, code: "TOO_LARGE" });
    }
  }

  if (!request.body) throw new ContentError({ status: 400, code: "VALIDATION" });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new ContentError({ status: 413, code: "TOO_LARGE" });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ContentError({ status: 400, code: "VALIDATION" });
  }
}
