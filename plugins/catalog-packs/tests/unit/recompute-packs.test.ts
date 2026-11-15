import { describe, expect, it } from 'vitest';
import { RecomputePacksService } from '../../application/recompute-packs.service';
import { aDefinition, aPackRecord, aProduct } from '../support/builders';
import { CTX, packWorld, SCOPE_A } from '../fakes/pack-world';

/** Components 11 (1 500) and 12 (2 000), pack product 20 storing 3 150 (10 % off). */
function arranged() {
  const world = packWorld();
  world.catalog.put(
    SCOPE_A,
    aProduct({ id: '11', price: 1500 }),
    aProduct({ id: '12', price: 2000 }),
    aProduct({ id: '20', type: 'pack', price: 3150, weight: 0 }),
  );
  world.packs.put(SCOPE_A, aPackRecord('20'));
  return { ...world, service: new RecomputePacksService(world.ports) };
}

describe('RecomputePacksService (D2203)', () => {
  it('recomputes every pack holding the changed product', async () => {
    // Arrange
    const { catalog, packs, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '21', type: 'pack', price: 3150 }));
    packs.put(SCOPE_A, aPackRecord('21', aDefinition({ packDiscountValue: 0 })));
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 2500 }));

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert: (2 500 + 2 000) × 0.9 and × 1
    expect(catalog.get(SCOPE_A, '20')?.price).toBe(4050);
    expect(catalog.get(SCOPE_A, '21')?.price).toBe(4500);
  });

  it('marks stale when a component is deleted', async () => {
    // Arrange
    const { catalog, packs, service } = arranged();
    catalog.remove(SCOPE_A, '12');

    // Act
    await service.recompute(CTX, SCOPE_A, '12');

    // Assert
    expect(packs.all(SCOPE_A)[0]?.status).toBe('stale');
    expect(catalog.get(SCOPE_A, '20')?.price).toBe(3150);
  });

  it('a component set to draft marks stale', async () => {
    // Arrange
    const { catalog, packs, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '12', price: 9000, status: 'draft' }));

    // Act
    await service.recompute(CTX, SCOPE_A, '12');

    // Assert: the last stored price stays
    expect(packs.all(SCOPE_A)[0]?.status).toBe('stale');
    expect(catalog.writes).toEqual([]);
  });

  it('a stale pack whose components are back is ok again', async () => {
    // Arrange
    const { packs, service } = arranged();
    packs.put(SCOPE_A, aPackRecord('20', { status: 'stale' }));

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert
    expect(packs.all(SCOPE_A)[0]?.status).toBe('ok');
  });

  it('drops pack rows when the pack product is no longer a pack', async () => {
    // Arrange
    const { catalog, packs, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '20', type: 'physical', price: 3150 }));

    // Act
    await service.recompute(CTX, SCOPE_A, '20');

    // Assert
    expect(packs.all(SCOPE_A)).toEqual([]);
  });

  it('drops pack rows when the pack product is deleted', async () => {
    // Arrange
    const { catalog, packs, service } = arranged();
    catalog.remove(SCOPE_A, '20');

    // Act
    await service.recompute(CTX, SCOPE_A, '20');

    // Assert
    expect(packs.all(SCOPE_A)).toEqual([]);
  });

  it('writes nothing when price and weight are unchanged', async () => {
    // Arrange
    const { catalog, service } = arranged();

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert
    expect(catalog.writes).toEqual([]);
  });

  it('writes the new weight when only a component weight changed', async () => {
    // Arrange
    const { catalog, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 1500, weight: 300 }));

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert
    expect(catalog.writes).toEqual([{ productId: '20', price: 3150, weight: 300, sharedOption: null }]);
  });

  it('reprices from the pack as stored once its lock is held, not the one read before (D2241)', async () => {
    // Arrange: a save commits a 0 % definition between the holding read and the recompute's lock
    const { catalog, lock, packs, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 2500 }));
    lock.onAcquire = () => {
      packs.put(SCOPE_A, aPackRecord('20', aDefinition({ packDiscountValue: 0 })));
    };

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert: (2 500 + 2 000) × 1, not × 0.9
    expect(lock.acquired).toEqual(['20']);
    expect(catalog.get(SCOPE_A, '20')?.price).toBe(4500);
  });

  it('does nothing for a pack removed before its lock is held', async () => {
    // Arrange
    const { catalog, lock, packs, service } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 2500 }));
    lock.onAcquire = () => {
      packs.remove(SCOPE_A, '20');
    };

    // Act
    await service.recompute(CTX, SCOPE_A, '11');

    // Assert
    expect(catalog.writes).toEqual([]);
    expect(packs.all(SCOPE_A)).toEqual([]);
  });
});
