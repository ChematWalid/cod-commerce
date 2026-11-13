import { type BusinessId, toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { TeamConvergeService } from '../../application/converge-members.service';
import { MEMBER_CONVERGE_PAGE_SIZE } from '../../domain/constants';
import { TeamConvergeFailedError } from '../../domain/converge-failure';
import { asOperationContext } from '../../domain/ports/operation-context';
import {
  builderIds,
  type FakeAdministrator,
  FakeTeamWorld,
  fixedClock,
  InlineTransaction,
} from '../fakes/converge-fakes';
import { InMemoryMemberRepository } from '../fakes/in-memory-member-repository';
import { invitedMember, scopeA, scopeB, T0 } from '../support/builders';

const ctx = asOperationContext({});
const A = scopeA.businessId;
const B = scopeB.businessId;

const administrator = (
  businessId: BusinessId,
  administratorId: number,
  overrides: Partial<FakeAdministrator> = {},
): FakeAdministrator => ({
  businessId,
  administratorId,
  email: `Admin-${String(administratorId)}@Example.test`,
  firstName: `First ${String(administratorId)}`,
  lastName: 'Last',
  holdsRole: true,
  ...overrides,
});

function setUp(businessIds: readonly BusinessId[], administrators: FakeAdministrator[]) {
  const world = new FakeTeamWorld(businessIds, administrators);
  const members = new InMemoryMemberRepository();
  const transaction = new InlineTransaction();
  const service = new TeamConvergeService({
    directory: world,
    holders: world,
    profiles: world,
    members,
    transaction,
    ids: builderIds,
    clock: fixedClock(T0),
  });
  return { world, members, transaction, service };
}

describe('TeamConvergeService.adoptAdministrators', () => {
  it('makes the administrator an active member who joined now, with no salary and no grant snapshot', async () => {
    // Arrange
    const { members, service } = setUp([A], [administrator(A, 7)]);

    // Act
    const result = await service.adoptAdministrators(ctx, scopeA, [7]);

    // Assert
    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(members.rows).toEqual([
      expect.objectContaining({
        businessId: A,
        administratorId: 7,
        email: 'Admin-7@Example.test',
        emailKey: 'admin-7@example.test',
        firstName: 'First 7',
        lastName: 'Last',
        status: 'active',
        suspendedAccess: null,
        commissionConfigIds: [],
        baseSalary: 0,
        maxOpenOrders: null,
        receivingOrders: true,
        invitedByAdministratorId: null,
        invitedAt: null,
        joinedAt: T0,
        removedAt: null,
        createdAt: T0,
        updatedAt: T0,
      }),
    ]);
  });

  it('adds nothing for an administrator who already has a member row', async () => {
    // Arrange
    const { members, service } = setUp([A], [administrator(A, 7)]);
    await service.adoptAdministrators(ctx, scopeA, [7]);

    // Act
    const result = await service.adoptAdministrators(ctx, scopeA, [7]);

    // Assert
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(members.rows).toHaveLength(1);
  });

  it('adds nothing for an administrator that is deleted or of another business', async () => {
    // Arrange
    const { members, service } = setUp([A, B], [administrator(A, 7, { deleted: true }), administrator(B, 8)]);

    // Act
    const result = await service.adoptAdministrators(ctx, scopeA, [7, 8]);

    // Assert
    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(members.rows).toEqual([]);
  });

  it('skips an administrator whose address a live member of the business already has', async () => {
    // Arrange
    const { members, service } = setUp([A], [administrator(A, 7)]);
    await members.insert(
      ctx,
      scopeA,
      invitedMember(scopeA, { email: ' admin-7@example.TEST', emailKey: 'admin-7@example.test' }),
    );

    // Act
    const result = await service.adoptAdministrators(ctx, scopeA, [7]);

    // Assert
    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(members.rows.filter((row) => row.administratorId === 7)).toEqual([]);
  });

  it('runs in one transaction of the business', async () => {
    // Arrange
    const { transaction, service } = setUp([A], [administrator(A, 7)]);

    // Act
    await service.adoptAdministrators(ctx, scopeA, [7]);

    // Assert
    expect(transaction.scopes).toEqual([scopeA]);
  });
});

describe('TeamConvergeService.convergeMembers', () => {
  it('adds one row per live role holder of every business, the owner included, and a second run adds none', async () => {
    // Arrange
    const { members, service } = setUp(
      [A, B],
      [
        administrator(A, 1),
        administrator(A, 2),
        administrator(A, 3, { holdsRole: false }),
        administrator(A, 4, { deleted: true }),
        administrator(B, 5),
      ],
    );

    // Act
    const first = await service.convergeMembers(ctx);
    const second = await service.convergeMembers(ctx);

    // Assert
    expect(first).toEqual({ businesses: 2, created: 3, skipped: 0 });
    expect(second).toEqual({ businesses: 2, created: 0, skipped: 0 });
    expect(members.rows.map((row) => [row.businessId, row.administratorId])).toEqual([
      [A, 1],
      [A, 2],
      [B, 5],
    ]);
  });

  it('walks every page of businesses', async () => {
    // Arrange
    const ids = Array.from({ length: MEMBER_CONVERGE_PAGE_SIZE + 1 }, (_, index) => toBusinessId(String(1000 + index)));
    const { world, service } = setUp(ids, []);

    // Act
    const report = await service.convergeMembers(ctx);

    // Assert
    expect(report.businesses).toBe(MEMBER_CONVERGE_PAGE_SIZE + 1);
    expect(world.pageCalls).toEqual([undefined, ids[MEMBER_CONVERGE_PAGE_SIZE - 1]]);
  });

  it('converges the other businesses when one fails, then names the one that failed', async () => {
    // Arrange
    const { world, members, service } = setUp([A, B], [administrator(A, 1), administrator(B, 2)]);
    const failing = world.profilesOf.bind(world);
    world.profilesOf = (c, scope, ids) =>
      scope.businessId === A ? Promise.reject(new Error('profiles unavailable')) : failing(c, scope, ids);

    // Act
    const converging = service.convergeMembers(ctx);

    // Assert
    await expect(converging).rejects.toBeInstanceOf(TeamConvergeFailedError);
    await expect(converging).rejects.toMatchObject({
      businesses: 2,
      created: 1,
      failures: [{ businessId: A, reason: 'profiles unavailable' }],
    });
    expect(members.rows.map((row) => row.administratorId)).toEqual([2]);
  });
});
