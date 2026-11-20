import { IMPORT_MAX_UNCOMPRESSED_BYTES, IMPORT_MAX_ZIP_ENTRIES, IMPORT_MAX_ZIP_RATIO } from '@cod/shared';

/** One entry of a zip's central directory: its name and the sizes the directory claims. */
export interface ZipEntry {
  readonly name: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  /** The compression method (0 stored, 8 deflate) and where the entry's local header starts. */
  readonly method: number;
  readonly localHeaderOffset: number;
}

/** Why a zip is refused before any parser sees it (D2222). */
export type ZipRefusal = 'not-a-zip' | 'too-many-entries' | 'too-large' | 'ratio' | 'no-workbook';

/** The verdict of {@link inspectZip}: the entries, and where the directory starts (the local records end there). */
export type ZipVerdict =
  | { readonly ok: true; readonly entries: readonly ZipEntry[]; readonly directoryOffset: number }
  | { readonly ok: false; readonly reason: ZipRefusal };

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_RECORD_BYTES = 22;
const CENTRAL_RECORD_BYTES = 46;
const MAX_COMMENT_BYTES = 0xffff;
/** A size field holding this means the real size is in a ZIP64 record: never needed by a 10 MiB xlsx. */
const ZIP64_MARKER = 0xffffffff;
/** The parts every OOXML workbook holds; a zip missing one is not a workbook (D2253). */
const WORKBOOK_PARTS = ['[Content_Types].xml', 'xl/workbook.xml'] as const;
/** Field offsets of the end-of-central-directory record (APPNOTE 4.3.16). */
const END_FIELDS = { countOnDisk: 8, count: 10, size: 12, offset: 16 } as const;
/** Field offsets of a central directory record (APPNOTE 4.3.12). */
const CENTRAL_FIELDS = {
  method: 10,
  compressed: 20,
  uncompressed: 24,
  nameLength: 28,
  extraLength: 30,
  commentLength: 32,
  localHeaderOffset: 42,
} as const;
const names = new TextDecoder('utf-8');

interface Directory {
  readonly count: number;
  readonly size: number;
  readonly offset: number;
}

/**
 * The end-of-central-directory record, looked for backwards past a comment of at most 64 KiB. The directory must end
 * exactly where the end record starts, with all its records on this disk: a streaming unzipper reads a local record it
 * meets anywhere before the end record, so no byte may sit between the directory and the end record (D2266).
 */
function directoryOf(bytes: Uint8Array): Directory | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.length - END_RECORD_BYTES - MAX_COMMENT_BYTES);
  for (let at = bytes.length - END_RECORD_BYTES; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) !== END_SIGNATURE) continue;
    const directory = {
      count: view.getUint16(at + END_FIELDS.count, true),
      size: view.getUint32(at + END_FIELDS.size, true),
      offset: view.getUint32(at + END_FIELDS.offset, true),
    };
    const sameDisk = view.getUint16(at + END_FIELDS.countOnDisk, true) === directory.count;
    return sameDisk && directory.offset + directory.size === at ? directory : undefined;
  }
  return undefined;
}

/** The directory's records, or undefined when one is cut or unsigned, or they do not fill the directory exactly. */
function entriesOf(bytes: Uint8Array, directory: Directory): ZipEntry[] | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];
  let at = directory.offset;
  for (let index = 0; index < directory.count; index += 1) {
    if (at + CENTRAL_RECORD_BYTES > directory.offset + directory.size) return undefined;
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) return undefined;
    const nameLength = view.getUint16(at + CENTRAL_FIELDS.nameLength, true);
    const tail =
      nameLength +
      view.getUint16(at + CENTRAL_FIELDS.extraLength, true) +
      view.getUint16(at + CENTRAL_FIELDS.commentLength, true);
    const nameStart = at + CENTRAL_RECORD_BYTES;
    entries.push({
      name: names.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      compressedSize: view.getUint32(at + CENTRAL_FIELDS.compressed, true),
      uncompressedSize: view.getUint32(at + CENTRAL_FIELDS.uncompressed, true),
      method: view.getUint16(at + CENTRAL_FIELDS.method, true),
      localHeaderOffset: view.getUint32(at + CENTRAL_FIELDS.localHeaderOffset, true),
    });
    at = nameStart + tail;
  }
  return at === directory.offset + directory.size ? entries : undefined;
}

const ratioTooHigh = (entry: ZipEntry): boolean => entry.uncompressedSize > entry.compressedSize * IMPORT_MAX_ZIP_RATIO;

/** The first limit of D2222 the entries break, or undefined. */
function refusalOf(entries: readonly ZipEntry[]): ZipRefusal | undefined {
  if (entries.length > IMPORT_MAX_ZIP_ENTRIES) return 'too-many-entries';
  if (entries.some((entry) => entry.uncompressedSize === ZIP64_MARKER || entry.compressedSize === ZIP64_MARKER)) {
    return 'too-large';
  }
  const total = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (total > IMPORT_MAX_UNCOMPRESSED_BYTES) return 'too-large';
  if (entries.some(ratioTooHigh)) return 'ratio';
  const isWorkbook = WORKBOOK_PARTS.every((part) => entries.some((entry) => entry.name === part));
  return isWorkbook ? undefined : 'no-workbook';
}

/**
 * Checks a zip's central directory before exceljs reads it (D2222): at most {@link IMPORT_MAX_ZIP_ENTRIES} entries,
 * {@link IMPORT_MAX_UNCOMPRESSED_BYTES} uncompressed in all, no entry above {@link IMPORT_MAX_ZIP_RATIO}:1, and an
 * `xl/workbook.xml` and a `[Content_Types].xml` (D2253: the sniff accepts any zip). Only the sizes the directory
 * claims are read, so a deflate bomb is refused without inflating it. A directory can lie: `localHeadersMatch` then
 * checks that the local records a streaming reader sees are these entries, and the reader inflates each part within
 * its claimed size (D2266).
 */
export function inspectZip(bytes: Uint8Array): ZipVerdict {
  const directory = bytes.length < END_RECORD_BYTES ? undefined : directoryOf(bytes);
  const entries = directory === undefined ? undefined : entriesOf(bytes, directory);
  if (directory === undefined || entries === undefined) return { ok: false, reason: 'not-a-zip' };
  const reason = refusalOf(entries);
  if (reason !== undefined) return { ok: false, reason };
  return { ok: true, entries, directoryOffset: directory.offset };
}
