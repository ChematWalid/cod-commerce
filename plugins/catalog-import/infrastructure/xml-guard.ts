import { inflateRawSync } from 'node:zlib';
import { FileTypeError } from '../domain/errors';
import type { ZipEntry } from '../domain/zip-inspect';

const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_RECORD_BYTES = 30;
/** Field offsets of a local file header (APPNOTE 4.3.7). */
const LOCAL_FIELDS = { nameLength: 26, extraLength: 28 } as const;
const STORED = 0;
const DEFLATED = 8;
/** The parts exceljs parses as XML. */
const XML_PART = /\.(xml|rels)$/i;
/** A document type declaration or an entity definition: the door to entity expansion (D2222). */
const DTD_MARKUP = /<!(DOCTYPE|ENTITY)/i;
const NUL = /\0/g;

/** The entry's data as stored in the zip, located through its local header. */
function storedDataOf(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const at = entry.localHeaderOffset;
  if (at + LOCAL_RECORD_BYTES > bytes.length) throw new FileTypeError();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(at, true) !== LOCAL_SIGNATURE) throw new FileTypeError();
  const start =
    at +
    LOCAL_RECORD_BYTES +
    view.getUint16(at + LOCAL_FIELDS.nameLength, true) +
    view.getUint16(at + LOCAL_FIELDS.extraLength, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new FileTypeError();
  return bytes.subarray(start, end);
}

/**
 * The entry's bytes, inflated to at most the size the central directory claims: a directory that lies about a part's
 * size is refused here instead of inflating past the caps `inspectZip` checked.
 */
function partBytesOf(bytes: Uint8Array, entry: ZipEntry): Buffer {
  const data = storedDataOf(bytes, entry);
  if (entry.method === STORED) return Buffer.from(data);
  if (entry.method !== DEFLATED) throw new FileTypeError();
  try {
    return inflateRawSync(data, { maxOutputLength: Math.max(1, entry.uncompressedSize) });
  } catch (error: unknown) {
    // zlib refuses a corrupt stream or one inflating past the claimed size: either way not a readable workbook.
    if (error instanceof Error) throw new FileTypeError();
    throw error;
  }
}

/**
 * Refuses a workbook whose XML parts declare a document type or an entity (D2222), in UTF-8 or UTF-16, before exceljs
 * parses any of them; every XML part is inflated within the size its directory entry claims.
 *
 * @throws {@link FileTypeError} for a DTD, an entity, a part larger than claimed or an unreadable entry
 */
export function assertNoDtd(bytes: Uint8Array, entries: readonly ZipEntry[]): void {
  for (const entry of entries) {
    if (!XML_PART.test(entry.name)) continue;
    const text = partBytesOf(bytes, entry).toString('latin1').replace(NUL, '');
    if (DTD_MARKUP.test(text)) throw new FileTypeError();
  }
}
