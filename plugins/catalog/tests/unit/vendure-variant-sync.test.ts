import type { ProductVariantService, RequestContext } from '@vendure/core';
import { LanguageCode } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import type { ProductFields } from '../../domain/product';
import type { MatrixPlan } from '../../domain/variant-matrix';
import { VendureVariantSync } from '../../infrastructure/vendure-variant-sync.adapter';

const groups = [
  { id: toCoreId('1'), name: 'Color', values: [{ id: toCoreId('1'), name: 'Red' }] },
  { id: toCoreId('2'), name: 'Size', values: [{ id: toCoreId('3'), name: 'S' }] },
];
const plan = {
  keep: [],
  remove: [],
  create: [{ sku: 'TS-1', price: 2500, name: 'Shirt - Red / S', optionValues: ['Red', 'S'] }],
} as unknown as MatrixPlan;
const fields = { oldPrice: null, barcode: null } as unknown as ProductFields;

describe('VendureVariantSync', () => {
  it('names the options of a new variant with the integer ids Vendure compares them to', async () => {
    // Arrange
    const created: { optionIds: unknown[] }[] = [];
    const variants = {
      create: (_ctx: unknown, inputs: { optionIds: unknown[] }[]) => {
        created.push(...inputs);
        return Promise.resolve([]);
      },
    } as unknown as ProductVariantService;
    const target = { ctx: {} as RequestContext, productId: toCoreId('9'), language: LanguageCode.ar };

    // Act
    await new VendureVariantSync(variants).apply(target, plan, groups, { current: [], fields });

    // Assert
    expect(created[0]?.optionIds).toEqual([1, 3]);
  });

  it('names the variants it changes, renames and resets with integer ids, or core would insert new rows', async () => {
    // Arrange
    const updated: { id: unknown }[] = [];
    const variants = {
      update: (_ctx: unknown, inputs: { id: unknown }[]) => {
        updated.push(...inputs);
        return Promise.resolve([]);
      },
    } as unknown as ProductVariantService;
    const sync = new VendureVariantSync(variants);
    const target = { ctx: {} as RequestContext, productId: toCoreId('9'), language: LanguageCode.ar };
    const renamePlan = {
      keep: [{ id: toCoreId('5'), name: 'New name' }],
      remove: [],
      create: [],
    } as unknown as MatrixPlan;

    // Act
    await sync.apply(target, renamePlan, groups, { current: [{ id: toCoreId('5'), name: 'Old' }] as never, fields });
    await sync.applyChanges(target, [{ id: toCoreId('6'), price: 10 }] as never);
    await sync.syncDefault(target, toCoreId('7'), { ...fields, price: 10, sku: 'X' });

    // Assert
    expect(updated.map((input) => input.id)).toEqual([5, 6, 7]);
  });
});
