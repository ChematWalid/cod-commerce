import type { ProductOptionGroupService, ProductOptionService, ProductService, RequestContext } from '@vendure/core';
import { LanguageCode } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { VendureOptionSync } from '../../infrastructure/vendure-option-sync';

describe('VendureOptionSync', () => {
  it('names the groups and options it renames with integer ids, or core would insert new rows', async () => {
    // Arrange
    const updated: unknown[] = [];
    const record = (input: { id: unknown }) => {
      updated.push(input.id);
      return Promise.resolve({ id: input.id });
    };
    const groups = { update: (_ctx: unknown, input: { id: unknown }) => record(input) };
    const options = { update: (_ctx: unknown, input: { id: unknown }) => record(input) };
    const sync = new VendureOptionSync(
      {} as ProductService,
      groups as unknown as ProductOptionGroupService,
      options as unknown as ProductOptionService,
    );
    const target = { ctx: {} as RequestContext, productId: toCoreId('9'), language: LanguageCode.ar };
    const current = [{ id: toCoreId('2'), name: 'Size', values: [{ id: toCoreId('3'), name: 'S' }] }];

    // Act
    await sync.sync(target, current, [{ name: 'size', values: ['s'] }]);

    // Assert
    expect(updated).toEqual([2, 3]);
  });
});
