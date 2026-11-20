import { describe, expect, it } from 'vitest';
import { sniffSpreadsheet } from '../../domain/file-sniff';
import { XLSX_ENTRIES, zipOf } from '../support/zip-builder';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

describe('sniffSpreadsheet (D2208)', () => {
  it('xlsx zip with content types', () => {
    // Act and Assert
    expect(sniffSpreadsheet(zipOf(XLSX_ENTRIES))).toBe('xlsx');
  });

  it('zip without content types is null', () => {
    // Arrange
    const zip = zipOf([{ name: 'word/document.xml', compressed: 10, uncompressed: 20 }]);

    // Act and Assert
    expect(sniffSpreadsheet(zip)).toBeNull();
  });

  it('HTML is null', () => {
    // Act and Assert
    expect(sniffSpreadsheet(utf8('  <!DOCTYPE html><html><body>name,price</body></html>'))).toBeNull();
  });

  it('UTF-8 CSV with BOM is csv', () => {
    // Arrange
    const csv = new Uint8Array([...BOM, ...utf8('الاسم;السعر\r\nقميص;1500\r\n')]);

    // Act and Assert
    expect(sniffSpreadsheet(csv)).toBe('csv');
  });

  it('a NUL byte in the head is null', () => {
    // Act and Assert
    expect(sniffSpreadsheet(utf8('name,price\n\u0000shirt,1500\n'))).toBeNull();
  });

  it('a head cut inside a multi-byte character is still csv', () => {
    // Arrange: 8 KiB of Arabic, the last character cut after its first byte
    const text = utf8('ا'.repeat(4096));
    const cut = text.slice(0, 8191);

    // Act and Assert
    expect(sniffSpreadsheet(cut)).toBe('csv');
  });

  it.each([
    ['invalid UTF-8', new Uint8Array([0x6e, 0xff, 0xfe, 0x2c])],
    ['an empty file', new Uint8Array([])],
    ['a BOM alone', BOM],
  ])('%s is null', (_name, bytes) => {
    // Act and Assert
    expect(sniffSpreadsheet(bytes)).toBeNull();
  });
});
