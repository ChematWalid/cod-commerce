import { FileTooLargeError } from '../domain/errors';

const concat = (chunks: readonly Uint8Array[], size: number): Uint8Array => {
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

/**
 * Reads a body to its end, refusing it as soon as it passes `maxBytes` (a stated length can lie).
 * @throws {@link FileTooLargeError} above `maxBytes`
 */
export async function collectBytes(
  body: Uint8Array | AsyncIterable<Uint8Array>,
  maxBytes: number = Number.MAX_SAFE_INTEGER,
): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    if (body.length > maxBytes) throw new FileTooLargeError();
    return body;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > maxBytes) throw new FileTooLargeError();
    chunks.push(chunk);
  }
  return concat(chunks, size);
}
