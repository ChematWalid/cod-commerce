import { readdirSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import type { SqlRunner } from './tenant-tables';

/**
 * The hostile images of the P2 suite and what it reads to prove nothing was stored (P2.S1 Task 13 deviation (7)):
 * the catalog checks the file signature itself, while the decoding and the 40-megapixel limit are auth's content
 * guard, which only a full server runs.
 */

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
/** 8-bit greyscale: one byte per pixel, the smallest valid header. */
const BIT_DEPTH = 8;
const GREYSCALE = 0;
const IHDR_LENGTH = 13;

/** A PNG chunk: its length, type, data and the CRC of type and data. */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A PNG whose header says `width` x `height` and whose image data is `data`. */
function pngOf(width: number, height: number, data: Buffer): Buffer {
  const header = Buffer.alloc(IHDR_LENGTH);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH;
  header[9] = GREYSCALE;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', data), chunk('IEND', Buffer.alloc(0))]);
}

/** A PNG signature and header with image data that does not inflate: only decoding finds it out. */
export const CORRUPT_PNG = pngOf(1, 1, Buffer.from('not a deflate stream'));

const OVERSIZED_WIDTH = 8000;
const OVERSIZED_HEIGHT = 6000;

/**
 * A complete, valid PNG of 8000 x 6000 black pixels (48 megapixels, over the 40-megapixel limit), about 47 KB: every
 * row is a filter byte and zeros, so it decodes in full and only the pixel limit can refuse it, not a corrupt body.
 */
export const OVERSIZED_PNG = pngOf(
  OVERSIZED_WIDTH,
  OVERSIZED_HEIGHT,
  deflateSync(Buffer.alloc(OVERSIZED_HEIGHT * (OVERSIZED_WIDTH + 1))),
);

/** What an upload would add to: asset rows, media library rows and files of the asset storage. */
export interface StoredState {
  readonly assets: number;
  readonly media: number;
  readonly files: number;
}

const countOf = async (sql: SqlRunner, statement: string): Promise<number> =>
  (await sql.query(statement, []))[0]?.n ?? 0;

/** The stored state of the whole platform: every asset row, media row and file under `assetDir`. */
export async function storedState(sql: SqlRunner, assetDir: string): Promise<StoredState> {
  const files = readdirSync(assetDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return {
    assets: await countOf(sql, 'SELECT count(*)::int AS n FROM "asset"'),
    media: await countOf(sql, 'SELECT count(*)::int AS n FROM "catalog_media"'),
    files: files.length,
  };
}

/** The storage identifier of an asset's source file (its key below the storage prefix). */
export async function sourceKeyOf(
  sql: { query(sql: string, parameters: unknown[]): Promise<{ source: string }[]> },
  assetId: string,
) {
  const rows = await sql.query('SELECT "source" FROM "asset" WHERE "id" = $1', [assetId.replace(/^T_/, '')]);
  return rows[0]?.source;
}
