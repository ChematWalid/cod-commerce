import type { ZipEntry } from './zip-inspect';

const LOCAL_SIGNATURE = 0x04034b50;
/** The signed data descriptor a streaming reader looks for to end an entry of unknown size (APPNOTE 4.3.9). */
const DESCRIPTOR_SIGNATURE = 0x08074b50;
const SIGNATURE_BYTES = 4;
const LOCAL_RECORD_BYTES = 30;
const DESCRIPTOR_BYTES = 16;
/** General purpose flag bit 3: sizes and CRC follow the data in a data descriptor. */
const DATA_DESCRIPTOR_FLAG = 0x08;
/** Field offsets of a local file header (APPNOTE 4.3.7) and of a signed data descriptor. */
const LOCAL_FIELDS = {
  flags: 6,
  method: 8,
  compressed: 18,
  uncompressed: 22,
  nameLength: 26,
  extraLength: 28,
} as const;
const DESCRIPTOR_FIELDS = { compressed: 8, uncompressed: 12 } as const;
const strictNames = new TextDecoder('utf-8', { fatal: true });

/** The first offset at or after `from` where the descriptor signature starts, or -1. */
function descriptorSignatureAt(view: DataView, from: number): number {
  for (let at = from; at + SIGNATURE_BYTES <= view.byteLength; at += 1) {
    if (view.getUint32(at, true) === DESCRIPTOR_SIGNATURE) return at;
  }
  return -1;
}

/** The local header's name, or undefined when it is not valid UTF-8 (so it cannot equal a directory name). */
function localNameOf(bytes: Uint8Array, at: number, length: number): string | undefined {
  try {
    return strictNames.decode(bytes.subarray(at, at + length));
  } catch (error: unknown) {
    // A name that is not UTF-8 is read by unzippers in another code page: it cannot be compared, so it is refused.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

/**
 * Where the record after a data-descriptor entry starts: a streaming reader ends the data at the first descriptor
 * signature, so that signature must sit exactly where the directory says the data ends, with the directory's sizes.
 */
function afterDescriptor(bytes: Uint8Array, view: DataView, data: { start: number; entry: ZipEntry }): number {
  const end = data.start + data.entry.compressedSize;
  if (end + DESCRIPTOR_BYTES > bytes.length || descriptorSignatureAt(view, data.start) !== end) return -1;
  const sizesMatch =
    view.getUint32(end + DESCRIPTOR_FIELDS.compressed, true) === data.entry.compressedSize &&
    view.getUint32(end + DESCRIPTOR_FIELDS.uncompressed, true) === data.entry.uncompressedSize;
  return sizesMatch ? end + DESCRIPTOR_BYTES : -1;
}

/** Where the record after `entry`'s local record starts, or -1 when the local header disagrees with the directory. */
function recordEnd(bytes: Uint8Array, view: DataView, entry: ZipEntry): number {
  const at = entry.localHeaderOffset;
  if (at + LOCAL_RECORD_BYTES > bytes.length || view.getUint32(at, true) !== LOCAL_SIGNATURE) return -1;
  const nameLength = view.getUint16(at + LOCAL_FIELDS.nameLength, true);
  const start = at + LOCAL_RECORD_BYTES + nameLength + view.getUint16(at + LOCAL_FIELDS.extraLength, true);
  const sameEntry =
    view.getUint16(at + LOCAL_FIELDS.method, true) === entry.method &&
    localNameOf(bytes, at + LOCAL_RECORD_BYTES, nameLength) === entry.name;
  if (!sameEntry) return -1;
  const compressed = view.getUint32(at + LOCAL_FIELDS.compressed, true);
  if ((view.getUint16(at + LOCAL_FIELDS.flags, true) & DATA_DESCRIPTOR_FLAG) !== 0) {
    // A sized local header with a descriptor makes streaming readers stumble on the descriptor: refused.
    return compressed === 0 ? afterDescriptor(bytes, view, { start, entry }) : -1;
  }
  const sizesMatch =
    compressed === entry.compressedSize &&
    view.getUint32(at + LOCAL_FIELDS.uncompressed, true) === entry.uncompressedSize;
  const end = start + entry.compressedSize;
  return sizesMatch && end <= bytes.length ? end : -1;
}

/**
 * Whether the zip's local records, read in order from its first byte as a streaming unzipper reads them (exceljs's
 * `unzipper.Parse`), are exactly the central directory's entries (D2266): each entry's local header at the offset the
 * directory gives, with its name, method and sizes, the records back to back with no gap and nothing extra, the last
 * one ending where the directory starts. The limits `inspectZip` checks on the directory then hold for what exceljs
 * reads.
 */
export function localHeadersMatch(bytes: Uint8Array, entries: readonly ZipEntry[], directoryOffset: number): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ordered = [...entries].sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);
  let cursor = 0;
  for (const entry of ordered) {
    if (entry.localHeaderOffset !== cursor) return false;
    cursor = recordEnd(bytes, view, entry);
    if (cursor < 0) return false;
  }
  return cursor === directoryOffset;
}
