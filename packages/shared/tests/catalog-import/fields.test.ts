import { describe, expect, it } from 'vitest';
import { EXPORT_HEADER, IMPORT_FIELD_KEYS, IMPORT_FIELDS, normalizeImportHeader } from '../../src/index';

describe('import fields (D2209)', () => {
  it('every field key is unique and snake_case', () => {
    for (const key of IMPORT_FIELD_KEYS) expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    expect(new Set(IMPORT_FIELD_KEYS).size).toBe(IMPORT_FIELD_KEYS.length);
  });

  it('aliases are unique across fields after normalisation', () => {
    // Arrange: the key itself maps too, so an exported file re-imports.
    const owner = new Map<string, string>();
    const clashes: string[] = [];

    // Act
    for (const field of IMPORT_FIELDS) {
      const names = [field.key, ...field.aliases.ar, ...field.aliases.en, ...field.aliases.fr];
      for (const name of new Set(names.map(normalizeImportHeader))) {
        const previous = owner.get(name);
        if (previous !== undefined && previous !== field.key) clashes.push(`${name}: ${previous} / ${field.key}`);
        owner.set(name, field.key);
      }
    }

    // Assert
    expect(clashes).toEqual([]);
  });

  it('gives every field an alias in Arabic, English and French', () => {
    for (const field of IMPORT_FIELDS) {
      expect(field.aliases.ar.length * field.aliases.en.length * field.aliases.fr.length).toBeGreaterThan(0);
    }
  });

  it('export header equals the field keys in order', () => {
    expect(EXPORT_HEADER).toEqual(IMPORT_FIELD_KEYS);
    expect(EXPORT_HEADER).toEqual([
      'product_key',
      'name',
      'description',
      'status',
      'type',
      'price',
      'old_price',
      'weight',
      'brand',
      'tags',
      'collections',
      'option1_name',
      'option1_value',
      'option2_name',
      'option2_value',
      'option3_name',
      'option3_value',
      'variant_sku',
      'barcode',
      'image_urls',
    ]);
  });

  it('requires the name and price columns only', () => {
    expect(IMPORT_FIELDS.filter((field) => field.required).map((field) => field.key)).toEqual(['name', 'price']);
  });

  it('normalises case, accents, marks, tatweel, separators and a BOM', () => {
    expect(normalizeImportHeader('\uFEFF  Prix_de-Vente ')).toBe('prix de vente');
    expect(normalizeImportHeader('Ancien PRIX')).toBe(normalizeImportHeader('ancien prix'));
    expect(normalizeImportHeader('Clé produit')).toBe('cle produit');
    expect(normalizeImportHeader('\u0627\u0644\u0633\u0650\u0651\u0639\u0631')).toBe(normalizeImportHeader('السعر'));
    expect(normalizeImportHeader('\u0627\u0644\u0633\u0640\u0640\u0639\u0631')).toBe(normalizeImportHeader('السعر'));
  });
});
