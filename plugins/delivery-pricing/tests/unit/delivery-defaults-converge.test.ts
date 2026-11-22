import { toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DeliveryDefaultsConvergeFailedError } from '../../domain/errors';
import { storeKeyOf } from '../fakes/in-memory-fee-groups';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1, world } from '../support/world';

describe('DeliveryDefaultsConvergeService.linkStore (store creation, D3111)', () => {
  it("creates the store's platform default table and makes it the store's default", async () => {
    // Arrange
    const { converge, groups, storeDefaults } = world();

    // Act
    const id = await converge.linkStore(ctx, STORE_A1);

    // Assert
    expect(await groups.platformDefaultId(ctx, STORE_A1)).toBe(id);
    expect(storeDefaults.defaults.get(storeKeyOf(STORE_A1))).toBe(id);
  });
});

describe('DeliveryDefaultsConvergeService.convergeAll (migrate, D3112)', () => {
  it('links a default table to every active store without one, and is idempotent', async () => {
    // Arrange
    const { converge, groups, storeDefaults } = world();
    storeDefaults.stores.push(STORE_A1, STORE_A2, STORE_B1);

    // Act
    const first = await converge.convergeAll(ctx);
    const second = await converge.convergeAll(ctx);

    // Assert
    expect(first).toEqual({ stores: 3, linked: 3 });
    expect(second).toEqual({ stores: 3, linked: 0 });
    for (const scope of [STORE_A1, STORE_A2, STORE_B1]) {
      const platformDefault = await groups.platformDefaultId(ctx, scope);
      expect(storeDefaults.defaults.get(storeKeyOf(scope))).toBe(platformDefault);
    }
  });

  it('keeps a default group the store owns', async () => {
    // Arrange
    const { converge, saving, storeDefaults } = world();
    const own = await saving.create(ctx, STORE_A1, groupInput());
    storeDefaults.stores.push(STORE_A1);
    storeDefaults.defaults.set(storeKeyOf(STORE_A1), own.id);

    // Act
    const report = await converge.convergeAll(ctx);

    // Assert
    expect(report).toEqual({ stores: 1, linked: 0 });
    expect(storeDefaults.defaults.get(storeKeyOf(STORE_A1))).toBe(own.id);
  });

  it("keeps the merchant's group linked between the page read and the store's transaction", async () => {
    // Arrange
    const { converge, saving, storeDefaults } = world();
    const own = await saving.create(ctx, STORE_A1, groupInput());
    storeDefaults.stores.push(STORE_A1);
    storeDefaults.beforeLock = (scope) => storeDefaults.defaults.set(storeKeyOf(scope), own.id);

    // Act
    const report = await converge.convergeAll(ctx);

    // Assert
    expect(report).toEqual({ stores: 1, linked: 0 });
    expect(storeDefaults.defaults.get(storeKeyOf(STORE_A1))).toBe(own.id);
    expect(storeDefaults.locked).toEqual([storeKeyOf(STORE_A1)]);
  });

  it("repairs a dangling id, such as another business's group stored before #230", async () => {
    // Arrange
    const { converge, saving, groups, storeDefaults } = world();
    const foreign = await saving.create(ctx, STORE_B1, groupInput());
    storeDefaults.stores.push(STORE_A1);
    storeDefaults.defaults.set(storeKeyOf(STORE_A1), foreign.id);

    // Act
    const report = await converge.convergeAll(ctx);

    // Assert
    expect(report).toEqual({ stores: 1, linked: 1 });
    expect(storeDefaults.defaults.get(storeKeyOf(STORE_A1))).toBe(await groups.platformDefaultId(ctx, STORE_A1));
  });

  it('converges the other stores, then fails with every store that could not be linked', async () => {
    // Arrange
    const { converge, storeDefaults } = world();
    storeDefaults.stores.push(STORE_A1, STORE_A2, STORE_B1);
    storeDefaults.failing.add(storeKeyOf(STORE_A2));

    // Act
    const run = converge.convergeAll(ctx);

    // Assert
    await expect(run).rejects.toBeInstanceOf(DeliveryDefaultsConvergeFailedError);
    await expect(run).rejects.toMatchObject({
      failures: [
        {
          businessId: STORE_A2.businessId,
          storeId: STORE_A2.storeId,
          reason: 'store 1000000000000000012 refused the link',
        },
      ],
    });
    expect(storeDefaults.defaults.has(storeKeyOf(STORE_A1))).toBe(true);
    expect(storeDefaults.defaults.has(storeKeyOf(STORE_B1))).toBe(true);
  });

  it('pages on when the directory answers a page shorter than asked, until a page comes back empty', async () => {
    // Arrange
    const { converge, storeDefaults } = world();
    storeDefaults.stores.push(STORE_A1, STORE_A2, STORE_B1);
    storeDefaults.pageCap = 2;

    // Act
    const report = await converge.convergeAll(ctx);

    // Assert
    expect(report).toEqual({ stores: 3, linked: 3 });
  });

  it('pages through more stores than one page holds', async () => {
    // Arrange
    const { converge, storeDefaults } = world();
    const many = Array.from({ length: 501 }, (_unused, index) => ({
      businessId: STORE_A1.businessId,
      storeId: toStoreId(toSnowflake(String(2000000000000000000n + BigInt(index)))),
    }));
    storeDefaults.stores.push(...many);

    // Act
    const report = await converge.convergeAll(ctx);

    // Assert
    expect(report).toEqual({ stores: 501, linked: 501 });
  });
});
