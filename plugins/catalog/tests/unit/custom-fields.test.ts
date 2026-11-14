import type { CustomFieldConfig, RuntimeVendureConfig } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { configureCatalogCustomFields } from '../../infrastructure/custom-fields';

type Entity = 'Product' | 'ProductVariant' | 'ProductOptionGroup' | 'ProductOption';

function configured(): Record<Entity, CustomFieldConfig[]> {
  const config = {
    customFields: { Product: [], ProductVariant: [], ProductOptionGroup: [], ProductOption: [], Administrator: [] },
  } as unknown as RuntimeVendureConfig;
  return configureCatalogCustomFields(config).customFields;
}

const namesOf = (fields: readonly CustomFieldConfig[]): string[] => fields.map((field) => field.name);
const fieldOf = (fields: readonly CustomFieldConfig[], name: string) => fields.find((field) => field.name === name);

describe('configureCatalogCustomFields', () => {
  it('adds the product, variant and option fields of D2100 and the variant defaults of Task 11', () => {
    // Act
    const fields = configured();

    // Assert
    expect(namesOf(fields.Product)).toEqual([
      'status',
      'type',
      'oldPrice',
      'defaultPrice',
      'defaultSku',
      'brandId',
      'weight',
      'width',
      'height',
      'length',
      'label',
      'cardCaption',
      'metaTitle',
      'metaDescription',
    ]);
    expect(namesOf(fields.ProductVariant)).toEqual(['oldPrice', 'isHidden', 'barcode']);
    expect(namesOf(fields.ProductOptionGroup)).toEqual(['position']);
    expect(namesOf(fields.ProductOption)).toEqual(['position']);
  });

  it('labels every field in English and Arabic', () => {
    // Act
    const all = Object.values(configured()).flat();

    // Assert
    const unlabelled = all.filter((field) => {
      const languages = (field.label ?? []).map((label) => label.languageCode as string);
      return !(languages.includes('en') && languages.includes('ar'));
    });
    expect(unlabelled).toEqual([]);
  });

  it('keeps money and sizes non-negative and optional', () => {
    // Arrange
    const { Product, ProductVariant } = configured();
    const sized = ['oldPrice', 'weight', 'width', 'height', 'length'].map((name) => fieldOf(Product, name));

    // Act
    const shapes = [...sized, fieldOf(ProductVariant, 'oldPrice')].map((field) => ({
      type: field?.type,
      min: (field as { min?: number } | undefined)?.min,
      nullable: field?.nullable,
    }));

    // Assert
    expect(shapes).toEqual(Array.from({ length: 6 }, () => ({ type: 'int', min: 0, nullable: true })));
  });

  it('indexes the brand and barcode the list filters and the search read (D2123, D2140)', () => {
    // Act
    const { Product, ProductVariant } = configured();

    // Assert
    expect(fieldOf(Product, 'brandId')?.index).toBe(true);
    expect(fieldOf(ProductVariant, 'barcode')?.index).toBe(true);
  });

  it('keeps merchant-only fields out of the Shop API', () => {
    // Arrange
    const { Product, ProductVariant } = configured();
    const merchantOnly = [
      ...['status', 'type', 'defaultPrice', 'defaultSku', 'brandId', 'weight', 'width', 'height', 'length'].map(
        (name) => fieldOf(Product, name),
      ),
      ...['isHidden', 'barcode'].map((name) => fieldOf(ProductVariant, name)),
    ];

    // Act
    const publicOnes = merchantOnly.filter((field) => field?.public !== false).map((field) => field?.name);

    // Assert
    expect(publicOnes).toEqual([]);
  });

  it('starts a product as a physical draft and a variant as shown', () => {
    // Act
    const { Product, ProductVariant } = configured();

    // Assert
    expect(fieldOf(Product, 'status')?.defaultValue).toBe('draft');
    expect(fieldOf(Product, 'type')?.defaultValue).toBe('physical');
    expect(fieldOf(ProductVariant, 'isHidden')?.defaultValue).toBe(false);
  });
});
