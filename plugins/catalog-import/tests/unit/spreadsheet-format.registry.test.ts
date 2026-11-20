import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { SpreadsheetFormatRegistry } from '../../application/spreadsheet-format.registry';

interface FakeAdapter {
  readonly reader: string;
  readonly writer: string;
}

describe('SpreadsheetFormatRegistry (D2209)', () => {
  it('a new format registers without editing callers', () => {
    // Arrange
    const registry = new SpreadsheetFormatRegistry<FakeAdapter>();
    const ods = { reader: 'ods reader', writer: 'ods writer' };
    registry.register('csv', { reader: 'csv reader', writer: 'csv writer' });

    // Act
    registry.register('ods', ods);

    // Assert
    expect(registry.get('ods')).toBe(ods);
    expect(registry.formats()).toEqual(['csv', 'ods']);
  });

  it('an unknown format is refused', () => {
    // Arrange
    const registry = new SpreadsheetFormatRegistry<FakeAdapter>();

    // Act and Assert
    expect(() => registry.get('pdf')).toThrow(expect.objectContaining({ code: CATALOG_IMPORT_ERROR_CODES.FILE_TYPE }));
  });

  it('refuses a second adapter for one format', () => {
    // Arrange
    const registry = new SpreadsheetFormatRegistry<FakeAdapter>();
    registry.register('csv', { reader: 'a', writer: 'b' });

    // Act and Assert
    expect(() => {
      registry.register('csv', { reader: 'c', writer: 'd' });
    }).toThrow(/csv/);
  });
});
