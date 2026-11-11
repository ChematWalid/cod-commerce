import { BUILT_IN_ROLES, toBusinessId } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeedBuiltInRolesService } from '../../application/seed-built-in-roles.service';
import type { BusinessRole, MemberAssignment, RoleBinding } from '../../domain/business-role';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FixedClock } from '../fakes/fixed-clock';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

const ctx = asOperationContext({});
const businessId = toBusinessId('7001');
const OWNER_ROLE_ID = 41;
const OWNER_ADMINISTRATOR_ID = 42;
const NOW = new Date('2026-11-09T10:00:00Z');

describe('SeedBuiltInRolesService', () => {
  let calls: string[];
  let roles: BusinessRole[];
  let bindings: RoleBinding[];
  let assignments: MemberAssignment[];
  let service: SeedBuiltInRolesService;

  beforeEach(() => {
    calls = [];
    roles = [];
    bindings = [];
    assignments = [];
    const record =
      <T>(name: string, rows: T[]) =>
      (_ctx: unknown, _scope: unknown, row: T) => {
        calls.push(name);
        rows.push(row);
        return Promise.resolve();
      };
    service = new SeedBuiltInRolesService({
      lock: {
        acquire: () => {
          calls.push('lock');
          return Promise.resolve();
        },
      },
      roles: { insert: record('role', roles) },
      bindings: { insert: record('binding', bindings) },
      assignments: { insert: record('assignment', assignments) },
      ids: new SequentialIdGenerator(),
      clock: new FixedClock(NOW),
    });
  });

  const seed = (): Promise<void> =>
    service.seed(ctx, { businessId, ownerRoleId: OWNER_ROLE_ID, ownerAdministratorId: OWNER_ADMINISTRATOR_ID });

  it('takes the lock before it writes anything', async () => {
    await seed();

    expect(calls[0]).toBe('lock');
  });

  it('writes one row per template, with its permissions and label', async () => {
    await seed();

    expect(roles.map((role) => role.builtInKey)).toEqual(BUILT_IN_ROLES.map((template) => template.key));
    expect(roles.map((role) => role.permissions.length)).toEqual([94, 77, 19, 12, 11, 3, 23]);
    expect(roles[0]).toMatchObject({ name: 'Owner', nameKey: 'owner', createdAt: NOW, updatedAt: NOW });
  });

  it('binds only Owner, on all stores, to the Vendure role tenancy made', async () => {
    await seed();

    expect(bindings).toEqual([
      expect.objectContaining({ businessRoleId: roles[0]?.id, scope: 'all', vendureRoleId: OWNER_ROLE_ID }),
    ]);
  });

  it('assigns Owner to the first administrator on all stores', async () => {
    await seed();

    expect(assignments).toEqual([
      expect.objectContaining({
        administratorId: OWNER_ADMINISTRATOR_ID,
        businessRoleId: roles[0]?.id,
        storeAccess: 'all',
        storeIds: [],
      }),
    ]);
  });
});
