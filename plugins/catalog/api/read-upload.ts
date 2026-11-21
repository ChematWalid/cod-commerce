// Copied from plugins/auth/api/read-upload.ts: a plugin never imports another plugin's internals (§3a.2).
import type { Readable } from 'node:stream';

/**
 * Reads a stream up to `limit` bytes, then stops and closes it: a caller can tell a file is over its limit by
 * getting more than `limit` bytes back, without the server ever holding the whole file.
 */
export async function readAtMost(stream: Readable, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    chunks.push(piece);
    size += piece.length;
    if (size > limit) {
      stream.destroy();
      break;
    }
  }
  return Buffer.concat(chunks);
}
