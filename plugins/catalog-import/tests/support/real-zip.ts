import { crc32, deflateRawSync } from 'node:zlib';

/** One file of a real test zip: its name and text, and how a test makes the zip lie about it. */
export interface ZipFile {
  readonly name: string;
  readonly text: string;
  /** The name the central directory lists it under, or null for a local entry the directory omits (smuggled). */
  readonly listedAs?: string | null;
  /** Written as streaming writers do: flag bit 3, zero sizes in the local header, a signed data descriptor after. */
  readonly descriptor?: boolean;
  /** Stored instead of deflated. */
  readonly stored?: boolean;
  /** The uncompressed size both headers claim, instead of the real one. */
  readonly claimedSize?: number;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const LOCAL_RECORD_BYTES = 30;
const CENTRAL_RECORD_BYTES = 46;
const END_RECORD_BYTES = 22;
const DESCRIPTOR_SIGNATURE = 0x08074b50;
const DESCRIPTOR_BYTES = 16;
const DESCRIPTOR_FLAG = 0x08;
const DEFLATE = 8;
const STORE = 0;
const VERSION = 20;
const utf8 = new TextEncoder();

interface Packed {
  readonly name: Uint8Array;
  readonly listedAs: Uint8Array | null;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
  readonly method: number;
  readonly descriptor: boolean;
}

function localRecord(file: Packed): Uint8Array {
  const record = new Uint8Array(LOCAL_RECORD_BYTES + file.name.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, file.descriptor ? DESCRIPTOR_FLAG : 0, true);
  view.setUint16(8, file.method, true);
  if (!file.descriptor) {
    view.setUint32(14, file.crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.size, true);
  }
  view.setUint16(26, file.name.length, true);
  record.set(file.name, LOCAL_RECORD_BYTES);
  return record;
}

function descriptorOf(file: Packed): Uint8Array {
  const record = new Uint8Array(file.descriptor ? DESCRIPTOR_BYTES : 0);
  if (!file.descriptor) return record;
  const view = new DataView(record.buffer);
  view.setUint32(0, DESCRIPTOR_SIGNATURE, true);
  view.setUint32(4, file.crc, true);
  view.setUint32(8, file.data.length, true);
  view.setUint32(12, file.size, true);
  return record;
}

function centralRecord(file: Packed & { readonly listedAs: Uint8Array }): Uint8Array {
  const record = new Uint8Array(CENTRAL_RECORD_BYTES + file.listedAs.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, CENTRAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, file.descriptor ? DESCRIPTOR_FLAG : 0, true);
  view.setUint16(10, file.method, true);
  view.setUint32(16, file.crc, true);
  view.setUint32(20, file.data.length, true);
  view.setUint32(24, file.size, true);
  view.setUint16(28, file.listedAs.length, true);
  view.setUint32(42, file.offset, true);
  record.set(file.listedAs, CENTRAL_RECORD_BYTES);
  return record;
}

function packedOf(file: ZipFile, offset: number): Packed {
  const raw = utf8.encode(file.text);
  const listedAs = file.listedAs === undefined ? file.name : file.listedAs;
  return {
    name: utf8.encode(file.name),
    listedAs: listedAs === null ? null : utf8.encode(listedAs),
    data: file.stored === true ? raw : deflateRawSync(raw),
    crc: crc32(raw),
    size: file.claimedSize ?? raw.length,
    offset,
    method: file.stored === true ? STORE : DEFLATE,
    descriptor: file.descriptor === true,
  };
}

const isListed = (file: Packed): file is Packed & { readonly listedAs: Uint8Array } => file.listedAs !== null;

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
 * A real, deflated zip of `files` that any unzip reads (CRC and local header offsets set), unless a file asks the
 * zip to lie about it.
 */
export function realZipOf(files: readonly ZipFile[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const packed: Packed[] = [];
  let offset = 0;
  for (const file of files) {
    const entry = packedOf(file, offset);
    const local = concat([localRecord(entry), entry.data, descriptorOf(entry)]);
    locals.push(local);
    packed.push(entry);
    offset += local.length;
  }
  const listed = packed.filter(isListed);
  const central = concat(listed.map(centralRecord));
  const end = new Uint8Array(END_RECORD_BYTES);
  const view = new DataView(end.buffer);
  view.setUint32(0, END_SIGNATURE, true);
  view.setUint16(8, listed.length, true);
  view.setUint16(10, listed.length, true);
  view.setUint32(12, central.length, true);
  view.setUint32(16, offset, true);
  return concat([...locals, central, end]);
}

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** An inline-string cell of a hand-written sheet. */
const inlineCell = (ref: string, text: string): string => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;

/** A sheet part whose rows hold inline strings; `prolog` goes between the declaration and the root. */
export function sheetXml(rows: readonly (readonly string[])[], prolog = ''): string {
  const body = rows
    .map((cells, rowIndex) => {
      const row = String(rowIndex + 1);
      const refs = cells.map((text, column) => inlineCell(`${String.fromCharCode(65 + column)}${row}`, text));
      return `<row r="${row}">${refs.join('')}</row>`;
    })
    .join('');
  return `${XML_DECL}${prolog}<worksheet xmlns="${SHEET_NS}"><sheetData>${body}</sheetData></worksheet>`;
}

/** The parts of a one-sheet workbook around `sheet`. */
export function workbookFilesOf(sheet: string): ZipFile[] {
  return [
    {
      name: '[Content_Types].xml',
      text:
        `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      text: `${XML_DECL}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `${XML_DECL}<workbook xmlns="${SHEET_NS}" xmlns:r="${REL_NS}"><sheets><sheet name="products" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `${XML_DECL}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: 'xl/worksheets/sheet1.xml', text: sheet },
  ];
}

/** The parts of a one-sheet workbook around `sheet`, as a hand-written xlsx. */
export const xlsxOf = (sheet: string): Uint8Array => realZipOf(workbookFilesOf(sheet));
