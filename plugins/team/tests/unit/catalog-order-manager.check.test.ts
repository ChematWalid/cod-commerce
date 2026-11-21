import { toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { AdministratorService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { CatalogOrderManagerCheck } from '../../infrastructure/catalog-order-manager.check';
import { FakeMemberAccess } from '../fakes/invitation-fakes';
import { InMemoryMemberRepository } from '../fakes/in-memory-member-repository';
import { invitedMember, scopeA, scopeB, T0 } from '../support/builders';

const ROLE = toSnowflake('901');
const S1 = toStoreId('11');
const S2 = toStoreId('12');
const businessA = toBusinessId(scopeA.businessId);
/** The check receives catalog's opaque context; any object stands for it here. */
const catalogCtx = {} as never;
const teamCtx = asOperationContext({});

function setUp(callerAdministratorId: number | null = 1) {
  const members = new InMemoryMemberRepository();
  const access = new FakeMemberAccess([]);
  const registrar = { register: vi.fn() };
  const findOneByUserId = vi.fn(() =>
    Promise.resolve(callerAdministratorId === null ? undefined : { id: callerAdministratorId }),
  );
  const administrators = { findOneByUserId } as unknown as AdministratorService;
  const check = new CatalogOrderManagerCheck(registrar, members, access, administrators);
  const addActive = async (administratorId: number, grant: { all: boolean; stores?: readonly string[] }) => {
    const member = invitedMember(scopeA, { status: 'active', administratorId, joinedAt: T0 });
    await members.insert(teamCtx, scopeA, member);
    access.held.set(administratorId, {
      roleIds: [ROLE],
      storeAccess: grant.all ? 'all' : 'selected',
      storeIds: (grant.stores ?? []).map(toSnowflake),
    });
    return member;
  };
  return { check, registrar, members, access, addActive };
}

describe('CatalogOrderManagerCheck (D2114, D2132)', () => {
  it('registers itself with the catalog once the application boots', () => {
    // Arrange
    const { check, registrar } = setUp();

    // Act
    check.onApplicationBootstrap();

    // Assert
    expect(registrar.register).toHaveBeenCalledWith(check);
  });

  it("knows active members whose store access covers the product's store", async () => {
    // Arrange
    const { check, addActive } = setUp();
    const everyStore = await addActive(10, { all: true });
    const firstStore = await addActive(11, { all: false, stores: [S1] });

    // Act
    const unknown = await check.unknownIds(catalogCtx, businessA, S1, [everyStore.id, firstStore.id]);

    // Assert
    expect(unknown).toEqual([]);
  });

  it("names a member whose store access excludes the product's store", async () => {
    // Arrange
    const { check, addActive } = setUp();
    const secondStore = await addActive(12, { all: false, stores: [S2] });

    // Act
    const unknown = await check.unknownIds(catalogCtx, businessA, S1, [secondStore.id]);

    // Assert
    expect(unknown).toEqual([secondStore.id]);
  });

  it('names a member of another business, an unknown id and a removed, inactive or invited member', async () => {
    // Arrange
    const { check, members, addActive } = setUp();
    const ofB = invitedMember(scopeB, { status: 'active', administratorId: 20 });
    await members.insert(teamCtx, scopeB, ofB);
    const removed = await addActive(21, { all: true });
    await members.update(teamCtx, scopeA, removed.id, { removedAt: T0 });
    const inactive = await addActive(22, { all: true });
    await members.update(teamCtx, scopeA, inactive.id, { status: 'inactive' });
    const invited = invitedMember(scopeA);
    await members.insert(teamCtx, scopeA, invited);
    const ids = [ofB.id, toSnowflake('999999'), removed.id, inactive.id, invited.id];

    // Act
    const unknown = await check.unknownIds(catalogCtx, businessA, S1, ids);

    // Assert
    expect(unknown).toEqual(ids);
  });

  it("answers 'all' for a caller reaching every store", async () => {
    // Arrange
    const { check, access } = setUp();
    access.reach = { allStores: true, storeIds: [] };

    // Act
    const stores = await check.accessibleStoreIds({ activeUserId: 5 } as never, businessA);

    // Assert
    expect(stores).toBe('all');
  });

  it('answers the stores of a store-limited caller', async () => {
    // Arrange
    const { check, access } = setUp();
    access.reach = { allStores: false, storeIds: [toSnowflake(S1)] };

    // Act
    const stores = await check.accessibleStoreIds({ activeUserId: 5 } as never, businessA);

    // Assert
    expect(stores).toEqual(new Set([S1]));
  });

  it('answers no store for a caller with no administrator', async () => {
    // Arrange
    const { check } = setUp(null);

    // Act
    const stores = await check.accessibleStoreIds({ activeUserId: 5 } as never, businessA);

    // Assert
    expect(stores).toEqual(new Set());
  });
});
