import { toBusinessId, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { LiveMemberAssignments } from '../../application/live-member-assignments';
import type { MemberAssignment } from '../../domain/business-role';
import type { MemberAssignmentRepositoryPort } from '../../domain/ports/member-assignment-repository.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeActorDirectory } from '../fakes/fake-actor-directory';

const LIVE = 7;
const DEPARTED = 8;
const ROLE = toSnowflake('100');
const ctx = asOperationContext({});
const scope = { businessId: toBusinessId('1') };

const row = (administratorId: number): MemberAssignment => ({
  id: toSnowflake(String(200 + administratorId)),
  administratorId,
  businessRoleId: ROLE,
  storeAccess: 'all',
  storeIds: [],
  createdAt: new Date(0),
});

const rows: readonly MemberAssignment[] = [row(LIVE), row(DEPARTED)];

const stored: MemberAssignmentRepositoryPort = {
  insert: () => Promise.resolve(),
  isAssigned: () => Promise.resolve(true),
  ofAdministrator: (_c, _s, id) => Promise.resolve(rows.filter((r) => r.administratorId === id)),
  ofRoles: () => Promise.resolve(rows),
  replaceFor: () => Promise.resolve(),
  holdersOf: () => Promise.resolve([LIVE, DEPARTED]),
  allStoresAdministratorIds: () => Promise.resolve([LIVE, DEPARTED]),
};

const live = new LiveMemberAssignments(stored, new FakeActorDirectory(new Map([[LIVE, 'Amina Benali']])));

describe('LiveMemberAssignments', () => {
  it('gives a soft-deleted administrator no roles', async () => {
    // Act
    const held = await live.ofAdministrator(ctx, scope, DEPARTED);

    // Assert
    expect(held).toEqual([]);
  });

  it('keeps a live administrator its roles', async () => {
    // Act
    const held = await live.ofAdministrator(ctx, scope, LIVE);

    // Assert
    expect(held.map((r) => r.administratorId)).toEqual([LIVE]);
  });

  it('drops soft-deleted holders from role rows and from holders', async () => {
    // Act
    const roleRows = await live.ofRoles(ctx, scope, [ROLE]);
    const holders = await live.holdersOf(ctx, scope, [ROLE]);

    // Assert
    expect(roleRows.map((r) => r.administratorId)).toEqual([LIVE]);
    expect(holders).toEqual([LIVE]);
  });

  it('still lists every all-stores administrator for session eviction', async () => {
    // Act
    const ids = await live.allStoresAdministratorIds(ctx, scope);

    // Assert
    expect(ids).toEqual([LIVE, DEPARTED]);
  });
});
