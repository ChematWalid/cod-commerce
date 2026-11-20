import { type BulkEditCommand, CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES, toSnowflake } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { BulkEditService } from '../../application/bulk-edit.service';
import { asOperationContext } from '../../application/ports/operation-context';
import type { ActivityActor } from '../../application/ports/product-activity.port';
import type { EditableProduct } from '../../domain/bulk-edit-plan';
import { FakeBulkEditWorld } from '../fakes/fake-bulk-edit';
import { SCOPE } from '../support/scope';

const ctx = asOperationContext({});
const actor: ActivityActor = { administratorId: 5, ip: '192.0.2.1', userAgent: 'synthetic-agent' };

const productOf = (id: string, price = 1000): EditableProduct => ({
  id,
  status: 'active',
  brandId: null,
  tagIds: ['801'],
  price,
  variants: [{ id: `${id}1`, price }],
});

const command = (productIds: string[], changes: BulkEditCommand['changes'], dryRun = false): BulkEditCommand => ({
  productIds,
  changes,
  dryRun,
});

describe('bulk edit use case (D2213)', () => {
  let world: FakeBulkEditWorld;
  let service: BulkEditService;

  beforeEach(() => {
    const products = new Map(['1', '2', '3'].map((id) => [id, productOf(id)] as const));
    world = new FakeBulkEditWorld(products, {
      brands: [{ id: toSnowflake('901'), name: 'Brand' }],
      tags: [
        { id: toSnowflake('801'), name: 'Summer' },
        { id: toSnowflake('802'), name: 'Winter' },
      ],
    });
    service = new BulkEditService({ catalog: world, units: world, activity: world });
  });

  it('sets Draft on 3 products, each in its own unit, with one activity row each', async () => {
    // Act
    const results = await service.edit(ctx, SCOPE, actor, command(['1', '2', '3'], { status: 'draft' }));

    // Assert
    expect(results).toEqual(
      ['1', '2', '3'].map((productId) => ({ productId, ok: true, changedFields: ['status'], error: null })),
    );
    expect(world.units).toHaveLength(3);
    expect(world.writesOf('status').map((write) => write.productId)).toEqual(['1', '2', '3']);
    expect(world.writesOf('activity')[0]?.activity).toEqual({
      scope: SCOPE,
      productId: '1',
      changedFields: ['status'],
      actor,
    });
  });

  it('records no activity row for a product nothing changed on', async () => {
    // Act
    const results = await service.edit(ctx, SCOPE, actor, command(['1'], { status: 'active' }));

    // Assert
    expect(results).toEqual([{ productId: '1', ok: true, changedFields: [], error: null }]);
    expect(world.committed).toEqual([]);
  });

  it('a foreign or deleted id is catalog.product-not-found; the others change', async () => {
    // Act
    const results = await service.edit(ctx, SCOPE, actor, command(['1', '404'], { status: 'hidden' }));

    // Assert
    expect(results[1]).toEqual({
      productId: '404',
      ok: false,
      changedFields: [],
      error: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    });
    expect(world.writesOf('status').map((write) => write.productId)).toEqual(['1']);
  });

  it('a price result below 0 is that product error; the others change', async () => {
    // Arrange
    world.products.set('2', productOf('2', 300));

    // Act
    const results = await service.edit(
      ctx,
      SCOPE,
      actor,
      command(['1', '2'], { price: { mode: 'amount', value: -500 } }),
    );

    // Assert
    expect(results.map((result) => result.error)).toEqual([null, CATALOG_IMPORT_ERROR_CODES.PRICE_OUT_OF_RANGE]);
    expect(world.writesOf('update').map((write) => write.productId)).toEqual(['1']);
  });

  it('a catalog refusal rolls back the product write and its activity row', async () => {
    // Arrange: the status is written first, then the catalog refuses the price
    world.refuseUpdateOf.add('2');

    // Act
    const results = await service.edit(
      ctx,
      SCOPE,
      actor,
      command(['1', '2'], { status: 'draft', price: { mode: 'fixed', value: 1500 } }),
    );

    // Assert
    expect(results[1]).toMatchObject({ ok: false, error: CATALOG_ERROR_CODES.INVALID_INPUT, changedFields: [] });
    expect(world.committed.some((write) => 'productId' in write && write.productId === '2')).toBe(false);
    expect(world.writesOf('activity').map((write) => write.activity.productId)).toEqual(['1']);
  });

  it('a fault of the server is not reported as a product error', async () => {
    // Arrange
    world.faultOn.add('1');

    // Act and Assert
    await expect(service.edit(ctx, SCOPE, actor, command(['1'], { status: 'draft' }))).rejects.toThrow(
      'connection lost',
    );
  });

  it('an unknown or foreign brand fails the whole request with taxonomy-not-found, nothing written', async () => {
    // Act and Assert
    await expect(service.edit(ctx, SCOPE, actor, command(['1', '2'], { brandId: '999' }))).rejects.toMatchObject({
      code: CATALOG_IMPORT_ERROR_CODES.TAXONOMY_NOT_FOUND,
    });
    expect(world.units).toEqual([]);
  });

  it.each([
    ['added', { addTagIds: ['777'] }],
    ['removed', { removeTagIds: ['777'] }],
  ])('an unknown tag %s fails the whole request with taxonomy-not-found', async (_name, changes) => {
    // Act and Assert
    await expect(service.edit(ctx, SCOPE, actor, command(['1'], changes))).rejects.toMatchObject({
      code: CATALOG_IMPORT_ERROR_CODES.TAXONOMY_NOT_FOUND,
    });
    expect(world.units).toEqual([]);
  });

  it('resolves taxonomy ids as the boundary parses them and writes the stored spelling', async () => {
    // Act
    await service.edit(ctx, SCOPE, actor, command(['1'], { brandId: '0901', addTagIds: ['0802'] }));

    // Assert
    expect(world.writesOf('update')[0]?.patch).toEqual({ brandId: '901', tagIds: ['801', '802'] });
  });

  it('reads no taxonomy when the change names none', async () => {
    // Act
    await service.edit(ctx, SCOPE, actor, command(['1'], { status: 'draft', brandId: null }));

    // Assert
    expect(world.taxonomyReads).toBe(0);
  });

  it('collectionIds answers collections-unavailable before anything is read', async () => {
    // Act and Assert
    await expect(service.edit(ctx, SCOPE, actor, command(['1'], { collectionIds: ['5'] }))).rejects.toMatchObject({
      code: CATALOG_IMPORT_ERROR_CODES.COLLECTIONS_UNAVAILABLE,
    });
    expect(world.units).toEqual([]);
  });

  it('dryRun changes nothing and returns the same summary', async () => {
    // Arrange
    const changes = { status: 'draft', price: { mode: 'percent', value: 10 } } as const;

    // Act
    const dry = await service.edit(ctx, SCOPE, actor, command(['1', '404'], changes, true));
    const nothing = [...world.committed];
    const real = await service.edit(ctx, SCOPE, actor, command(['1', '404'], changes));

    // Assert
    expect(nothing).toEqual([]);
    expect(dry).toEqual(real);
  });

  it('applies a percent change once to a product named twice', async () => {
    // Act
    const results = await service.edit(
      ctx,
      SCOPE,
      actor,
      command(['1', '01'], { price: { mode: 'percent', value: 10 } }),
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(world.writesOf('update')).toHaveLength(1);
  });
});
