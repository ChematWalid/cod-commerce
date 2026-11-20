import { SNIFF_HEAD_BYTES } from './constants';

/** The formats a sniff can recognise; `null` is anything else. */
export type SniffedFormat = 'xlsx' | 'csv';

const ascii = new TextEncoder();
/** `PK\x03\x04`: a zip's first local file header. */
const ZIP_LOCAL_SIGNATURE = [...ascii.encode('PK\u0003\u0004')];
/** The UTF-8 byte order mark Excel writes before a CSV. */
const UTF8_BOM = [...ascii.encode('\uFEFF')];
const NUL = 0x00;
const MARKUP_START = /^\s*</;

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

/** Decodes strict UTF-8; a character cut by the end of the head is not an error (`stream`). */
function utf8Text(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes, { stream: true });
  } catch (error: unknown) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function sniffText(head: Uint8Array): SniffedFormat | null {
  const body = startsWith(head, UTF8_BOM) ? head.subarray(UTF8_BOM.length) : head;
  if (body.length === 0 || body.includes(NUL)) return null;
  const text = utf8Text(body);
  if (text === null || MARKUP_START.test(text)) return null;
  return 'csv';
}

/**
 * What the first bytes of an uploaded object are (D2208): `xlsx` for any zip, `csv` for strict UTF-8 text (BOM
 * allowed) without a NUL byte that does not start like markup, else `null`. Only the first {@link SNIFF_HEAD_BYTES}
 * are read. A zip is only a candidate: its parts can sit anywhere in the file (exceljs's streaming writer and Google
 * Sheets put `[Content_Types].xml` last), so `inspectZip` decides from the central directory (D2222, D2253).
 */
export function sniffSpreadsheet(head: Uint8Array): SniffedFormat | null {
  const bytes = head.subarray(0, SNIFF_HEAD_BYTES);
  if (startsWith(bytes, ZIP_LOCAL_SIGNATURE)) return 'xlsx';
  return sniffText(bytes);
}
