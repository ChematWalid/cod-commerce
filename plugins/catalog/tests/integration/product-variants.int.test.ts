import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCT, type ProductResult, UPDATE_PRODUCT } from './catalog-kit';

const suite = catalogSuite(1021, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOT_FOUND = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
const MATRIX = {
  title: 'Shirt',
  price: 2500,
  sku: 'TS',
  optionGroups: [
    { name: 'Color', values: ['Red', 'Blue'] },
    { name: 'Size', values: ['S', 'M'] },
  ],
};

describe('product variants (AC1)', () => {
  const createMatrix = async (overrides: Record<string, unknown> = {}): Promise<ProductResult> => {
    await suite.kit.asOwner(suite.fixtures.a);
    return suite.kit.createProduct({ ...MATRIX, ...overrides });
  };
  const update = (id: string, input: Record<string, unknown>) =>
    suite.kit.gql<{ updateCatalogProduct: { product: ProductResult } }>(UPDATE_PRODUCT, { id, input });

  it('makes four variants named "Product - value / value" with skus <sku>-1 to -4', async () => {
    // Act
    const product = await createMatrix();

    // Assert
    expect(product.variants.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Shirt - Red / S', 'TS-1'],
      ['Shirt - Red / M', 'TS-2'],
      ['Shirt - Blue / S', 'TS-3'],
      ['Shirt - Blue / M', 'TS-4'],
    ]);
  });

  it('changes one price and keeps the three others, then hides one variant', async () => {
    // Arrange
    const product = await createMatrix({ sku: 'TP' });
    const [first, second] = product.variants;

    // Act
    const priced = await update(product.id, { variants: [{ id: first?.id, price: 3000 }] });
    const hidden = await update(product.id, { variants: [{ id: second?.id, isHidden: true }] });

    // Assert
    expect(priced.updateCatalogProduct.product.variants.map((variant) => variant.price)).toEqual([
      3000, 2500, 2500, 2500,
    ]);
    expect(hidden.updateCatalogProduct.product.variants.map((variant) => variant.isHidden)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it('answers not found for a variant id of another product, and changes nothing', async () => {
    // Arrange
    const product = await createMatrix({ sku: 'TA' });
    const other = await createMatrix({ title: 'Other', sku: 'TB' });

    // Act
    const failure = await failureOf(update(product.id, { variants: [{ id: other.variants[0]?.id, price: 1 }] }));

    // Assert
    expect(failure.codes).toEqual([NOT_FOUND]);
  });

  it("answers not found for B's variant id", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const ofB = await suite.kit.createProduct({ ...MATRIX, sku: 'BV' });
    const product = await createMatrix({ sku: 'TC' });

    // Act
    const failure = await failureOf(update(product.id, { variants: [{ id: ofB.variants[0]?.id, price: 1 }] }));

    // Assert
    expect(failure.codes).toEqual([NOT_FOUND]);
  });

  it("answers not found for a variant image naming another business's asset", async () => {
    // Arrange
    const product = await createMatrix({ sku: 'TD' });

    // Act
    const failure = await failureOf(
      update(product.id, { variants: [{ id: product.variants[0]?.id, featuredAssetId: 'T_1' }] }),
    );

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.MEDIA_NOT_FOUND]);
  });

  it("reuses only the product's own option groups, never another product's of the same name (D2135)", async () => {
    // Arrange / Act
    const first = await createMatrix({ sku: 'TE' });
    const second = await createMatrix({ title: 'Second', sku: 'TF' });

    // Assert
    const idsOf = (product: ProductResult) => product.optionGroups.map((group) => group.id);
    expect(idsOf(first).filter((id) => idsOf(second).includes(id))).toEqual([]);
  });

  it('keeps the edited variants when a value is removed and gives a re-added value the next free sku (Review Focus 3)', async () => {
    // Arrange
    const product = await createMatrix({ sku: 'TG' });
    const redS = product.variants[0];
    await update(product.id, { variants: [{ id: redS?.id, price: 999 }] });

    // Act
    await update(product.id, { optionGroups: [MATRIX.optionGroups[0], { name: 'Size', values: ['S'] }] });
    const readded = await update(product.id, { optionGroups: MATRIX.optionGroups });

    // Assert
    const variants = readded.updateCatalogProduct.product.variants;
    expect(variants.find((variant) => variant.id === redS?.id)?.price).toBe(999);
    // Free means held by no live variant: the soft-deleted M variants' skus are free again (Task 9).
    expect(variants.filter((variant) => variant.optionValues[1] === 'M').map((variant) => variant.sku)).toEqual([
      'TG-2',
      'TG-4',
    ]);
  });

  it('keeps the planned sku of the new default variant when a removed variant held the product sku', async () => {
    // Arrange: one variant is renamed to the product sku, then every option is removed
    const product = await createMatrix({ sku: 'TD' });
    await update(product.id, { variants: [{ id: product.variants[0]?.id, sku: 'TD' }] });

    // Act
    const saved = (await update(product.id, { optionGroups: [] })).updateCatalogProduct.product;

    // Assert
    expect(saved.variants).toHaveLength(1);
    expect(saved.variants[0]?.sku).not.toBe('TD');
    expect(saved.variants[0]?.sku).toMatch(/^TD-\d+$/);
  });

  it('refuses more than a hundred variants', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const values = (prefix: string) => Array.from({ length: 11 }, (_unused, index) => `${prefix}${String(index)}`);

    // Act
    const failure = await failureOf(
      suite.kit.client.query(
        gql('mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings } }'),
        {
          input: {
            ...MATRIX,
            status: 'active',
            optionGroups: [
              { name: 'A', values: values('a') },
              { name: 'B', values: values('b') },
            ],
          },
        },
      ),
    );

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.MATRIX_TOO_LARGE]);
  });

  it('runs two parallel option edits of one product one after the other, leaving no duplicate variant', async () => {
    // Arrange
    const product = await createMatrix({ sku: 'PL' });
    const withColor = [
      { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      { name: 'Size', values: ['S', 'M'] },
    ];
    const withSize = [
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M', 'L'] },
    ];

    // Act: a save that loses answers its refusal's codes, a save that wins answers none
    const codesOf = (saving: Promise<unknown>): Promise<readonly string[]> =>
      saving.then(
        () => [],
        async () => (await failureOf(saving)).codes,
      );
    const outcomes = await Promise.all([
      codesOf(update(product.id, { optionGroups: withColor })),
      codesOf(update(product.id, { optionGroups: withSize })),
    ]);

    // Assert: each save won or lost the race cleanly, and the stored matrix is whole and free of repeats
    const refusals = outcomes.filter((codes) => codes.length > 0);
    for (const codes of refusals) expect(codes).toEqual([CATALOG_ERROR_CODES.CONCURRENT_UPDATE]);
    expect(refusals.length).toBeLessThan(2);
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: ProductResult }>(PRODUCT, { id: product.id });
    const combinations = catalogProduct.variants.map((variant) => variant.optionValues.join('/'));
    const expected = catalogProduct.optionGroups.reduce((count, group) => count * group.values.length, 1);
    expect(combinations).toHaveLength(expected);
    expect(new Set(combinations).size).toBe(combinations.length);
    expect(new Set(catalogProduct.variants.map((variant) => variant.sku)).size).toBe(combinations.length);
  });
});
