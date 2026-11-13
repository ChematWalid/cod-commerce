import {
  ACTIVITY_ACTIONS,
  COMMISSION_BASES,
  type CommissionConfigCommand,
  teamCommissionActivityDiffSchema,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CommissionConfigService } from '../../application/commission-config.service';
import {
  CommissionInUseError,
  CommissionNameTakenError,
  CommissionNotFoundError,
  InvalidInputError,
  SelfActionError,
} from '../../domain/errors';
import { actorOfA, actorOfB, commissionWorld, STORE_A1, STORE_B1 } from '../fakes/commission-world';
import { invitedMember, scopeA, T0 } from '../support/builders';

/** A value no activity row may carry (D216). */
const SECRET_VALUE = 4_321;

const command = (overrides: Partial<CommissionConfigCommand> = {}): CommissionConfigCommand => ({
  name: 'Confirmation bonus',
  basis: 'per-confirmed-order',
  valueKind: 'fixed',
  value: SECRET_VALUE,
  scope: 'selected',
  storeIds: [STORE_A1],
  ...overrides,
});

function setUp() {
  const world = commissionWorld();
  return { world, service: new CommissionConfigService(world.ports) };
}

describe('CommissionConfigService.create', () => {
  it('stores the config under the business lock and logs which fields it set, never the value', async () => {
    // Arrange
    const { world, service } = setUp();

    // Act
    const created = await service.create(world.ctx, actorOfA, command());

    // Assert
    expect(world.commissions.rows).toEqual([created]);
    expect(created).toMatchObject({ businessId: scopeA.businessId, name: 'Confirmation bonus', value: SECRET_VALUE });
    expect(world.log.slice(0, 2)).toEqual(['begin', `lock:${scopeA.businessId}`]);
    const [row] = world.activity.commissionRows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.COMMISSION_CREATED);
    expect(teamCommissionActivityDiffSchema.parse(row?.diff)).toEqual({
      commissionConfigId: created.id,
      name: 'Confirmation bonus',
      changedFields: ['name', 'basis', 'valueKind', 'value', 'scope', 'storeIds'],
    });
    expect(JSON.stringify(world.activity.commissionRows)).not.toContain(String(SECRET_VALUE));
  });

  it('refuses a name the business already uses, whatever its case and spaces, and stores nothing', async () => {
    // Arrange
    const { world, service } = setUp();
    await service.create(world.ctx, actorOfA, command({ name: 'Bonus' }));

    // Act
    const again = service.create(world.ctx, actorOfA, command({ name: '  BONUS ' }));

    // Assert
    await expect(again).rejects.toBeInstanceOf(CommissionNameTakenError);
    expect(world.commissions.rows).toHaveLength(1);
    expect(world.activity.commissionRows).toHaveLength(1);
  });

  it('lets another business use the same name', async () => {
    // Arrange
    const { world, service } = setUp();
    await service.create(world.ctx, actorOfA, command({ name: 'Bonus' }));

    // Act
    const ofB = await service.create(world.ctx, actorOfB, command({ name: 'Bonus', storeIds: [STORE_B1] }));

    // Assert
    expect(ofB.businessId).toBe(actorOfB.scope.businessId);
    expect(world.commissions.rows).toHaveLength(2);
  });

  it('refuses a store of another business, and stores nothing', async () => {
    // Arrange
    const { world, service } = setUp();

    // Act
    const created = service.create(world.ctx, actorOfA, command({ storeIds: [STORE_A1, STORE_B1] }));

    // Assert
    await expect(created).rejects.toBeInstanceOf(InvalidInputError);
    expect(world.commissions.rows).toEqual([]);
  });

  it('refuses a percent above 100 %', async () => {
    // Arrange
    const { world, service } = setUp();

    // Act
    const created = service.create(world.ctx, actorOfA, command({ valueKind: 'percent', value: 10_001 }));

    // Assert
    await expect(created).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe('CommissionConfigService.update', () => {
  it('applies the edit and logs the changed field names, never the old or new value', async () => {
    // Arrange
    const { world, service } = setUp();
    const config = await service.create(world.ctx, actorOfA, command());

    // Act
    const updated = await service.update(world.ctx, actorOfA, config.id, { name: 'Delivery bonus', value: 9_876 });

    // Assert
    expect(updated).toMatchObject({ id: config.id, name: 'Delivery bonus', value: 9_876, createdAt: T0 });
    await expect(service.get(world.ctx, actorOfA, config.id)).resolves.toEqual(updated);
    const row = world.activity.commissionRows.at(-1);
    expect(row?.action).toBe(ACTIVITY_ACTIONS.COMMISSION_UPDATED);
    expect(teamCommissionActivityDiffSchema.parse(row?.diff).changedFields).toEqual(['name', 'value']);
    expect(JSON.stringify(row)).not.toMatch(new RegExp(`${String(SECRET_VALUE)}|9876`));
  });

  it("refuses a name another config of the business has, but takes a new case of the config's own", async () => {
    // Arrange
    const { world, service } = setUp();
    await service.create(world.ctx, actorOfA, command({ name: 'Taken' }));
    const config = await service.create(world.ctx, actorOfA, command({ name: 'Mine' }));

    // Act
    const clash = service.update(world.ctx, actorOfA, config.id, { name: 'taken' });
    const recased = await service.update(world.ctx, actorOfA, config.id, { name: 'MINE' });

    // Assert
    await expect(clash).rejects.toBeInstanceOf(CommissionNameTakenError);
    expect(recased.name).toBe('MINE');
  });

  it('refuses a store of another business', async () => {
    // Arrange
    const { world, service } = setUp();
    const config = await service.create(world.ctx, actorOfA, command());

    // Act
    const moved = service.update(world.ctx, actorOfA, config.id, { scope: 'selected', storeIds: [STORE_B1] });

    // Assert
    await expect(moved).rejects.toBeInstanceOf(InvalidInputError);
    await expect(service.get(world.ctx, actorOfA, config.id)).resolves.toEqual(config);
  });

  it("refuses an edit of a commission given to the actor's own member row (D212)", async () => {
    // Arrange
    const { world, service } = setUp();
    const config = await service.create(world.ctx, actorOfA, command());
    await world.members.insert(
      world.ctx,
      scopeA,
      invitedMember(scopeA, {
        status: 'active',
        administratorId: actorOfA.administratorId,
        commissionConfigIds: [config.id],
      }),
    );

    // Act
    const raised = service.update(world.ctx, actorOfA, config.id, { value: SECRET_VALUE * 2 });

    // Assert
    await expect(raised).rejects.toBeInstanceOf(SelfActionError);
    await expect(service.get(world.ctx, actorOfA, config.id)).resolves.toEqual(config);
  });
});

describe('CommissionConfigService.delete', () => {
  it('refuses a commission a live member is given, and keeps it', async () => {
    // Arrange
    const { world, service } = setUp();
    const config = await service.create(world.ctx, actorOfA, command());
    await world.members.insert(world.ctx, scopeA, invitedMember(scopeA, { commissionConfigIds: [config.id] }));

    // Act
    const deleted = service.delete(world.ctx, actorOfA, config.id);

    // Assert
    await expect(deleted).rejects.toBeInstanceOf(CommissionInUseError);
    expect(world.commissions.rows).toEqual([config]);
  });

  it('deletes a commission only removed members still name, and logs it', async () => {
    // Arrange
    const { world, service } = setUp();
    const config = await service.create(world.ctx, actorOfA, command());
    const removed = invitedMember(scopeA, { commissionConfigIds: [config.id], removedAt: T0 });
    await world.members.insert(world.ctx, scopeA, removed);

    // Act
    await service.delete(world.ctx, actorOfA, config.id);

    // Assert
    expect(world.commissions.rows).toEqual([]);
    const row = world.activity.commissionRows.at(-1);
    expect(row?.action).toBe(ACTIVITY_ACTIONS.COMMISSION_DELETED);
    expect(teamCommissionActivityDiffSchema.parse(row?.diff)).toEqual({
      commissionConfigId: config.id,
      name: config.name,
      changedFields: [],
    });
  });
});

describe('CommissionConfigService between two businesses', () => {
  it("never reads, edits or deletes another business's config", async () => {
    // Arrange
    const { world, service } = setUp();
    const ofA = await service.create(world.ctx, actorOfA, command());

    // Act
    const reads = [
      service.get(world.ctx, actorOfB, ofA.id),
      service.update(world.ctx, actorOfB, ofA.id, { value: 1 }),
      service.delete(world.ctx, actorOfB, ofA.id),
    ];

    // Assert
    for (const read of reads) await expect(read).rejects.toBeInstanceOf(CommissionNotFoundError);
    await expect(service.list(world.ctx, actorOfB)).resolves.toEqual([]);
    await expect(service.list(world.ctx, actorOfA)).resolves.toEqual([ofA]);
    expect(world.commissions.rows).toEqual([ofA]);
  });
});

describe('CommissionConfigService.bases', () => {
  it('offers every commission basis', () => {
    // Act and assert
    expect(setUp().service.bases()).toEqual(COMMISSION_BASES);
  });
});
