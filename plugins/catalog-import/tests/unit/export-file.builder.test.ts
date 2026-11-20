import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ExportFileBuilder } from '../../application/export-file.builder';
import { asOperationContext } from '../../application/ports/operation-context';
import type { ExportableProduct, ExportCell } from '../../domain/export-row';
import { SCOPE } from '../support/scope';

const CTX = asOperationContext({});

/** A physical product of `variants` variants, each one row of the file. */
function productOf(id: string, variants: number): ExportableProduct {
  return {
    id,
    title: `Synthetic product ${id}`,
    description: null,
    status: 'active',
    type: 'physical',
    sku: `SKU-${id}`,
    weight: null,
    brandId: '901',
    tagIds: ['801'],
    optionGroups: [{ name: 'Taille' }],
    variants: Array.from({ length: variants }, (_, index) => ({
      sku: `SKU-${id}-${String(index)}`,
      price: 1000,
      oldPrice: null,
      barcode: null,
      optionValues: [String(index)],
    })),
  };
}

/** A builder over a store of `products`, recording what its writer was given. */
function builderOf(products: readonly ExportableProduct[]) {
  const written: (readonly (readonly ExportCell[])[])[] = [];
  let taxonomyReads = 0;
  const builder = new ExportFileBuilder({
    reads: {
      product: (_ctx, _scope, id) => Promise.resolve(products.find((product) => product.id === id)),
      taxonomyIndex: () => {
        taxonomyReads += 1;
        return Promise.resolve({
          brands: [{ id: toSnowflake('901'), name: 'Atlas' }],
          tags: [{ id: toSnowflake('801'), name: 'Promo' }],
        });
      },
    },
    origins: { originsOf: () => Promise.resolve(new Map()) },
    formats: {
      get: () => ({
        contentType: 'text/csv',
        extension: 'csv',
        writer: {
          write: (_header, rows) => {
            written.push(rows);
            return Promise.resolve(new Uint8Array([1]));
          },
        },
      }),
    },
  });
  return { builder, written, taxonomyReads: () => taxonomyReads };
}

describe('ExportFileBuilder (D2259)', () => {
  it('writes no file when 2 products of 100 variants each pass the row cap', async () => {
    // Arrange
    const { builder, written } = builderOf([productOf('1', 100), productOf('2', 100)]);

    // Act
    const file = await builder.build(CTX, SCOPE, {
      productIds: ['1', '2'],
      fields: ['product_key', 'name', 'price'],
      format: 'csv',
      maxRows: 150,
    });

    // Assert
    expect(file).toBeUndefined();
    expect(written).toEqual([]);
  });

  it('writes one row per variant up to the cap, naming brand and tags from one taxonomy read', async () => {
    // Arrange
    const { builder, written, taxonomyReads } = builderOf([productOf('1', 100), productOf('2', 100)]);

    // Act
    const file = await builder.build(CTX, SCOPE, {
      productIds: ['1', '2'],
      fields: ['product_key', 'brand', 'tags'],
      format: 'csv',
      maxRows: 200,
    });

    // Assert
    expect(file?.rowCount).toBe(200);
    expect(written[0]?.[0]).toEqual(['SKU-1', 'Atlas', 'Promo']);
    expect(taxonomyReads()).toBe(1);
  });
});
