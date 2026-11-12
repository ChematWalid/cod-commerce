import { toBusinessId, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { MemberAccessService, type MemberAccessPorts } from '../../application/member-access.service';
import { MemberSuspensionRegistry } from '../../application/member-suspension-registry';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { FixedClock } from '../fakes/fixed-clock';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const ctx = asOperationContext({});
const scope = { businessId: toBusinessId('500') };

const role = (id: string): BusinessRole => ({
  id: toSnowflake(id),
  name: id,
  nameKey: id,
  description: null,
  builtInKey: null,
  permissions: ['orders.view'],
  createdAt: NOW,
  updatedAt: NOW,
});

const ROLES = [role('101'), role('102')];

const assignment = (administratorId: number, roleId: string): MemberAssignment => ({
  id: toSnowflake(String(900 + administratorId * 10 + Number(roleId) - 100)),
  administratorId,
  businessRoleId: toSnowflake(roleId),
  storeAccess: 'all',
  storeIds: [],
  createdAt: NOW,
});

/** A port call that must not happen: listing holders only reads roles and assignments. */
const untouched = (name: string) => (): Promise<never> => Promise.reject(new Error(`${name} must not be called`));

function portsWith(rows: readonly MemberAssignment[]): MemberAccessPorts {
  return {
    transaction: { run: <T>(c: OperationContext, _s: unknown, work: (t: OperationContext) => Promise<T>) => work(c) },
    lock: { acquire: untouched('acquire') },
    members: {
      isMember: untouched('isMember'),
      namesOf: untouched('namesOf'),
      liveAdministratorIds: untouched('liveAdministratorIds'),
    },
    directory: { stores: untouched('stores'), ownerAdministratorOf: untouched('ownerAdministratorOf') },
    roles: { all: () => Promise.resolve(ROLES) },
    assignments: {
      ofAdministrator: untouched('ofAdministrator'),
      // The live wrapper has already dropped soft-deleted holders by the time rows reach the service.
      ofRoles: (_c, _s, ids) => Promise.resolve(rows.filter((row) => ids.includes(row.businessRoleId))),
      replaceFor: untouched('replaceFor'),
    },
    engine: { setAdministratorRoles: untouched('setAdministratorRoles') },
    projector: { bindingsFor: untouched('bindingsFor'), releaseUnheld: untouched('releaseUnheld') },
    activity: { record: untouched('record') },
    flusher: { flushAdministrators: untouched('flushAdministrators') },
    suspension: new MemberSuspensionRegistry(),
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(NOW),
  };
}

describe('MemberAccessService.memberAdministratorIds', () => {
  it('lists every administrator holding at least one role of the business, once, in ascending order', async () => {
    // Arrange
    const service = new MemberAccessService(
      portsWith([assignment(9, '101'), assignment(3, '101'), assignment(3, '102'), assignment(5, '102')]),
    );

    // Act
    const holders = await service.memberAdministratorIds(ctx, scope);

    // Assert
    expect(holders).toEqual([3, 5, 9]);
  });

  it('lists nobody when no role is held', async () => {
    // Arrange
    const service = new MemberAccessService(portsWith([]));

    // Act
    const holders = await service.memberAdministratorIds(ctx, scope);

    // Assert
    expect(holders).toEqual([]);
  });
});

describe('MemberAccessService.roleNames', () => {
  it('names every role of the business by id', async () => {
    // Arrange
    const service = new MemberAccessService(portsWith([]));

    // Act
    const names = await service.roleNames(ctx, scope);

    // Assert
    expect([...names.entries()]).toEqual([
      ['101', '101'],
      ['102', '102'],
    ]);
  });
});

describe('MemberAccessService.accessOfHolders', () => {
  it('gives each live holder its roles and store access, keyed by administrator, in one read', async () => {
    // Arrange
    const selected: MemberAssignment = { ...assignment(5, '102'), storeAccess: 'selected', storeIds: [toSnowflake('11')] };
    const service = new MemberAccessService(portsWith([assignment(3, '101'), assignment(3, '102'), selected]));

    // Act
    const access = await service.accessOfHolders(ctx, scope);

    // Assert
    expect(access.get(3)).toEqual({
      administratorId: '3',
      roles: [
        { id: '101', name: '101' },
        { id: '102', name: '102' },
      ],
      storeAccess: 'all',
      storeIds: [],
    });
    expect(access.get(5)).toMatchObject({
      roles: [{ id: '102', name: '102' }],
      storeAccess: 'selected',
      storeIds: ['11'],
    });
    expect(access.has(9)).toBe(false);
  });

  it('is empty when the business has no role', async () => {
    // Arrange
    const service = new MemberAccessService({ ...portsWith([]), roles: { all: () => Promise.resolve([]) } });

    // Act
    const access = await service.accessOfHolders(ctx, scope);

    // Assert
    expect(access.size).toBe(0);
  });
});
