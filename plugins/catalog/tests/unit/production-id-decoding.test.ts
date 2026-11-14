import { productPatchSchema } from '@cod/shared';
import { AutoIncrementIdStrategy } from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { idArgOf } from '../../api/request-body';
import { DeleteProductService } from '../../application/delete-product.service';
import { GetProductService } from '../../application/get-product.service';
import { SetProductStatusService } from '../../application/set-product-status.service';
import { UpdateProductService } from '../../application/update-product.service';
import { ProductNotFoundError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { scopeA } from '../support/builders';

/**
 * Production decodes a GraphQL `ID` argument with Vendure's default `AutoIncrementIdStrategy` (`+id`), so a malformed
 * product id reaches our resolvers as a number such as 1.5, 0 or 1e20. The e2e and integration boots use the testing
 * strategy (`parseInt`) instead, so this is the only test of what production hands over (P2.S1 Task 14 review).
 */
const strategy = new AutoIncrementIdStrategy();
const MALFORMED_AS_SENT = ['1.5', '', '-1', 'abc', '99999999999999999999'];

describe('product ids as production decodes a GraphQL ID', () => {
  let world: ProductWorld;
  let portCalls: string[];

  beforeEach(() => {
    world = new ProductWorld();
    portCalls = [];
    for (const method of ['findOne', 'lockForUpdate', 'update', 'softDelete'] as const) {
      vi.spyOn(world.products, method).mockImplementation(() => {
        portCalls.push(method);
        return Promise.resolve(undefined as never);
      });
    }
  });

  const argOf = (sent: string): string => idArgOf(strategy.decodeId(sent));

  it.each(MALFORMED_AS_SENT)('finds no product for %j and never asks the catalog', async (sent) => {
    // Act
    const found = await new GetProductService(world.ports).byId(world.ctxOf(scopeA), scopeA, argOf(sent));

    // Assert
    expect(found).toBeUndefined();
    expect(portCalls).toEqual([]);
  });

  it.each(MALFORMED_AS_SENT)('answers not found to every write naming %j, before any catalog call', async (sent) => {
    // Arrange
    const ctx = world.ctxOf(scopeA);
    const id = argOf(sent);
    const writes = [
      () => new UpdateProductService(world.ports).update(ctx, scopeA, id, productPatchSchema.parse({ label: 'x' })),
      () => new SetProductStatusService(world.ports).set(ctx, scopeA, id, 'hidden'),
      () => new DeleteProductService(world.ports).delete(ctx, scopeA, id),
    ];

    // Act and Assert
    for (const write of writes) await expect(write()).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(portCalls).toEqual([]);
  });

  it('decodes "1.5" to the number 1.5, not to row 1 as the testing strategy does', () => {
    // Act
    const decoded = strategy.decodeId('1.5');

    // Assert
    expect(decoded).toBe(1.5);
    expect(idArgOf(decoded)).toBe('1.5');
  });
});
