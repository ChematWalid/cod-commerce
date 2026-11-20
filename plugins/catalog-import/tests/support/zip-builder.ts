/** One central directory record a test zip lists: its name and the sizes it claims. */
export interface ZipEntrySpec {
  readonly name: string;
  readonly compressed: number;
  readonly uncompressed: number;
  /** Bytes of (zero) data after the entry's local header, so a test can push later headers past a reader's window. */
  readonly stored?: number;
}

const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_RECORD_BYTES = 46;
const END_RECORD_BYTES = 22;
const LOCAL_RECORD_BYTES = 30;
const ascii = new TextEncoder();

function centralRecord(entry: ZipEntrySpec): Uint8Array {
  const name = ascii.encode(entry.name);
  const record = new Uint8Array(CENTRAL_RECORD_BYTES + name.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, CENTRAL_SIGNATURE, true);
  view.setUint32(20, entry.compressed, true);
  view.setUint32(24, entry.uncompressed, true);
  view.setUint16(28, name.length, true);
  record.set(name, CENTRAL_RECORD_BYTES);
  return record;
}

function endRecord(options: { entries: number; size: number; offset: number }): Uint8Array {
  const record = new Uint8Array(END_RECORD_BYTES);
  const view = new DataView(record.buffer);
  view.setUint32(0, END_SIGNATURE, true);
  view.setUint16(8, options.entries, true);
  view.setUint16(10, options.entries, true);
  view.setUint32(12, options.size, true);
  view.setUint32(16, options.offset, true);
  return record;
}

/** A local file header of `name`: what the first bytes of a real zip look like. */
function localRecord(name: string, stored = 0): Uint8Array {
  const encoded = ascii.encode(name);
  const record = new Uint8Array(LOCAL_RECORD_BYTES + encoded.length + stored);
  const view = new DataView(record.buffer);
  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(26, encoded.length, true);
  record.set(encoded, LOCAL_RECORD_BYTES);
  return record;
}

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * A synthetic zip: one local header per entry (names only, no data), then the central directory and its end record.
 * The sizes are what the directory claims, so a test can describe a bomb without building one.
 */
export function zipOf(entries: readonly ZipEntrySpec[]): Uint8Array {
  const locals = concat(entries.map((entry) => localRecord(entry.name, entry.stored)));
  const central = concat(entries.map(centralRecord));
  return concat([locals, central, endRecord({ entries: entries.length, size: central.length, offset: locals.length })]);
}

/** The entries every xlsx holds, small and well compressed. */
export const XLSX_ENTRIES: readonly ZipEntrySpec[] = [
  { name: '[Content_Types].xml', compressed: 400, uncompressed: 1_200 },
  { name: 'xl/workbook.xml', compressed: 300, uncompressed: 900 },
  { name: 'xl/worksheets/sheet1.xml', compressed: 2_000, uncompressed: 12_000 },
];
