// `readAtMost` is copied from plugins/catalog/api/read-upload.ts: a plugin never imports another plugin's internals
// (§3a.2). `readBodyAtMost` is its variant for a raw request body (D3142).
import type { Readable } from 'node:stream';

/** Reads `stream` until it ends or holds more than `limit` bytes; answers the bytes and whether it stopped early. */
async function collect(
  stream: AsyncIterable<unknown>,
  limit: number,
): Promise<{ readonly bytes: Buffer; readonly over: boolean }> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    chunks.push(piece);
    size += piece.length;
    if (size > limit) return { bytes: Buffer.concat(chunks), over: true };
  }
  return { bytes: Buffer.concat(chunks), over: false };
}

/**
 * Reads an uploaded file's stream up to `limit` bytes, then stops and closes it: a caller can tell a file is over its
 * limit by getting more than `limit` bytes back, without the server ever holding the whole file.
 */
export async function readAtMost(stream: Readable, limit: number): Promise<Buffer> {
  const { bytes, over } = await collect(stream.iterator({ destroyOnReturn: false }), limit);
  if (over) stream.destroy();
  return bytes;
}

/**
 * Reads a raw request body up to `limit` bytes, as {@link readAtMost}, but leaves the request open: destroying it
 * would close the socket before the answer, and Node discards an unread body once the answer is sent.
 */
export async function readBodyAtMost(request: Readable, limit: number): Promise<Buffer> {
  return (await collect(request.iterator({ destroyOnReturn: false }), limit)).bytes;
}
