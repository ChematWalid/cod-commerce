import { describe, expect, it } from 'vitest';
import { detectDelimiter } from '../../src/csv/delimiter';

describe('detectDelimiter (D2209, Review Focus 1)', () => {
  it('a comma file is comma-separated', () => {
    // Act and Assert
    expect(detectDelimiter('name,price,sku\r\nShirt,1500,S-1\r\n')).toBe(',');
  });

  it('a semicolon file from an Arabic or French Excel is semicolon-separated', () => {
    // Act and Assert
    expect(detectDelimiter('nom;prix;description\r\nChemise;1500;Coton, bleu\r\n')).toBe(';');
  });

  it('a tab file is tab-separated', () => {
    // Act and Assert
    expect(detectDelimiter('name\tprice\nShirt\t1500\n')).toBe('\t');
  });

  it('a separator inside quotes does not count', () => {
    // Act and Assert
    expect(detectDelimiter('name;price\r\n"A, B, C, D";1500\r\n"E, F";200\r\n')).toBe(';');
  });

  it('a one-column file defaults to comma', () => {
    // Act and Assert
    expect(detectDelimiter('name\r\nShirt\r\n')).toBe(',');
  });
});
