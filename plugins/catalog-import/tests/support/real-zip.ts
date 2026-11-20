import { crc32, deflateRawSync } from 'node:zlib';

/** One file of a real test zip: its name and text. */
export interface ZipFile {
  readonly name: string;
  readonly text: string;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const LOCAL_RECORD_BYTES = 30;
const CENTRAL_RECORD_BYTES = 46;
const END_RECORD_BYTES = 22;
const DEFLATE = 8;
const VERSION = 20;
const utf8 = new TextEncoder();

interface Packed {
  readonly name: Uint8Array;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
}

function localRecord(file: Packed): Uint8Array {
  const record = new Uint8Array(LOCAL_RECORD_BYTES + file.name.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(8, DEFLATE, true);
  view.setUint32(14, file.crc, true);
  view.setUint32(18, file.data.length, true);
  view.setUint32(22, file.size, true);
  view.setUint16(26, file.name.length, true);
  record.set(file.name, LOCAL_RECORD_BYTES);
  return record;
}

function centralRecord(file: Packed): Uint8Array {
  const record = new Uint8Array(CENTRAL_RECORD_BYTES + file.name.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, CENTRAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(10, DEFLATE, true);
  view.setUint32(16, file.crc, true);
  view.setUint32(20, file.data.length, true);
  view.setUint32(24, file.size, true);
  view.setUint16(28, file.name.length, true);
  view.setUint32(42, file.offset, true);
  record.set(file.name, CENTRAL_RECORD_BYTES);
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

/** A real, deflated zip of `files` that any unzip reads (CRC and local header offsets set). */
export function realZipOf(files: readonly ZipFile[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const packed: Packed[] = [];
  let offset = 0;
  for (const file of files) {
    const raw = utf8.encode(file.text);
    const entry = {
      name: utf8.encode(file.name),
      data: deflateRawSync(raw),
      crc: crc32(raw),
      size: raw.length,
      offset,
    };
    const local = concat([localRecord(entry), entry.data]);
    locals.push(local);
    packed.push(entry);
    offset += local.length;
  }
  const central = concat(packed.map(centralRecord));
  const end = new Uint8Array(END_RECORD_BYTES);
  const view = new DataView(end.buffer);
  view.setUint32(0, END_SIGNATURE, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
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

/** The parts of a one-sheet workbook around `sheet`, as a hand-written xlsx. */
export function xlsxOf(sheet: string): Uint8Array {
  return realZipOf([
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
  ]);
}
