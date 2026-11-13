import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { StoreNamesService } from '../../application/store-names.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { TenantStoresPort } from '../../domain/ports/tenant-stores.port';
import type { Store } from '../../domain/store';

const ctx = asOperationContext({});
const BUSINESS_A = toBusinessId('101');
const BUSINESS_B = toBusinessId('102');

const store = (id: string, businessId: string, name: string, status: Store['status'] = 'active'): Store =>
  ({ id: toStoreId(id), businessId, name, status }) as unknown as Store;

const STORES = [store('11', '101', 'Main'), store('12', '101', 'Old', 'archived'), store('21', '102', 'Other')];

/** The tenant stores of the fixture, confined to the business asked about, as the adapter is. */
const stores: Pick<TenantStoresPort, 'list'> = {
  list: (_ctx, businessId) => Promise.resolve(STORES.filter((row) => String(row.businessId) === String(businessId))),
};

describe('StoreNamesService', () => {
  it("names every store of the business, archived ones too, and none of another business's", async () => {
    // Arrange
    const service = new StoreNamesService({ stores });

    // Act
    const names = await service.namesOf(ctx, BUSINESS_A);

    // Assert
    expect([...names.entries()]).toEqual([
      ['11', 'Main'],
      ['12', 'Old'],
    ]);
  });

  it('names nothing for a business without stores', async () => {
    // Arrange
    const service = new StoreNamesService({ stores });

    // Act
    const names = await service.namesOf(ctx, toBusinessId('999'));

    // Assert
    expect(names.size).toBe(0);
    expect((await service.namesOf(ctx, BUSINESS_B)).get(toStoreId('21'))).toBe('Other');
  });
});
