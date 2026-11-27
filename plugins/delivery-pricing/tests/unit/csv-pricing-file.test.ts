import { describe, expect, it } from 'vitest';
import { InvalidPricingCsvFileError, PricingCsvTooManyRowsError } from '../../domain/errors';
import { CsvPricingFile } from '../../infrastructure/csv-pricing-file';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const file = new CsvPricingFile();

describe('CsvPricingFile.read', () => {
  it('reads comma-separated records, the byte order mark dropped', () => {
    // Act
    const records = file.read(utf8('﻿level,provinceCode\r\nwilaya,16\r\n'), 10);

    // Assert
    expect(records).toEqual([
      ['level', 'provinceCode'],
      ['wilaya', '16'],
    ]);
  });

  it('reads a semicolon file as an Arabic or French Excel writes it', () => {
    // Act
    const records = file.read(utf8('level;provinceCode\nwilaya;16\n'), 10);

    // Assert
    expect(records).toEqual([
      ['level', 'provinceCode'],
      ['wilaya', '16'],
    ]);
  });

  it('keeps a blank record so record numbers stay the spreadsheet rows', () => {
    // Act
    const records = file.read(utf8('a,b\n,\nc,d\n'), 10);

    // Assert
    expect(records).toHaveLength(3);
  });

  it.each([
    ['bytes that are not UTF-8', new Uint8Array([0x61, 0x2c, 0xe9, 0x0a])],
    ['an unclosed quote', utf8('a,"b\nc,d\n')],
    ['a record above the record size', utf8(`a,${'x'.repeat(5000)}\n`)],
  ])('refuses %s as an invalid file', (_label, bytes) => {
    // Act and Assert
    expect(() => file.read(bytes, 10)).toThrow(InvalidPricingCsvFileError);
  });

  it('refuses a record past the row cap', () => {
    // Act and Assert
    expect(() => file.read(utf8('a\nb\nc\n'), 2)).toThrow(PricingCsvTooManyRowsError);
  });

  it('reads exactly the row cap', () => {
    // Act and Assert
    expect(file.read(utf8('a\nb\n'), 2)).toHaveLength(2);
  });

  it('counts only records holding a cell: the row cap with blank records between and below them is read', () => {
    // Act
    const records = file.read(utf8('a,b\n,\nc,d\n\n , \n,\n'), 2);

    // Assert
    expect(records).toHaveLength(6);
  });
});

describe('CsvPricingFile.write', () => {
  it('writes UTF-8 with a byte order mark and CRLF lines, reading back as written', () => {
    // Arrange
    const records = [
      ['level', 'provinceCode'],
      ['wilaya', '16'],
    ];

    // Act
    const bytes = file.write(records);

    // Assert
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('level,provinceCode\r\nwilaya,16\r\n');
    expect(file.read(bytes, 10)).toEqual(records);
  });
});
