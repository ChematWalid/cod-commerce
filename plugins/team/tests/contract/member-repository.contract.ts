import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { MemberRepositoryPort } from '../../domain/ports/member-repository.port';
import { invitedMember, scopeA, scopeB, T0 } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link MemberRepositoryPort} adapter must have, tenant isolation included. */
export function describeMemberRepositoryContract(name: string, make: MakeHarness<MemberRepositoryPort>): void {
  describe(`${name} (MemberRepositoryPort contract)`, () => {
    it('finds a saved member by id in its business, with its grant snapshot and commissions', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const member = invitedMember(scopeA, {
        status: 'inactive',
        administratorId: 41,
        suspendedAccess: { roleIds: [toSnowflake('900')], storeAccess: 'selected', storeIds: [toSnowflake('11')] },
        commissionConfigIds: [toSnowflake('500'), toSnowflake('501')],
        maxOpenOrders: 12,
      });

      // Act
      await repo.insert(ctx, scopeA, member);

      // Assert
      await expect(repo.findById(ctx, scopeA, member.id)).resolves.toEqual(member);
      await expect(repo.findByAdministratorId(ctx, scopeA, 41)).resolves.toEqual(member);
    });

    it('finds a member to lock by id in its business only, removed ones included (D212)', async () => {
      // Arrange
      const { repo, ctx, inTransaction = (work) => work(ctx) } = await make();
      const member = invitedMember(scopeA, { status: 'active', administratorId: 43, removedAt: T0 });
      await repo.insert(ctx, scopeA, member);

      // Act
      const [found, foreign] = await inTransaction(async (transactional) => [
        await repo.findForUpdate(transactional, scopeA, member.id),
        await repo.findForUpdate(transactional, scopeB, member.id),
      ]);

      // Assert
      expect(found).toEqual(member);
      expect(foreign).toBeUndefined();
    });

    it("never finds or changes another business's member", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const memberOfA = invitedMember(scopeA, { administratorId: 42 });
      await repo.insert(ctx, scopeA, memberOfA);

      // Act
      const changed = await repo.update(ctx, scopeB, memberOfA.id, { baseSalary: 1 });

      // Assert
      expect(changed).toBe(false);
      await expect(repo.findById(ctx, scopeB, memberOfA.id)).resolves.toBeUndefined();
      await expect(repo.findLiveByEmailKey(ctx, scopeB, memberOfA.emailKey)).resolves.toBeUndefined();
      await expect(repo.findByAdministratorId(ctx, scopeB, 42)).resolves.toBeUndefined();
      await expect(repo.findById(ctx, scopeA, memberOfA.id)).resolves.toEqual(memberOfA);
    });

    it('lets two businesses hold the same email independently', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const inA = invitedMember(scopeA, { email: 'shared@example.test' });
      const inB = invitedMember(scopeB, { email: 'shared@example.test' });

      // Act
      await repo.insert(ctx, scopeA, inA);
      await repo.insert(ctx, scopeB, inB);

      // Assert
      await expect(repo.findLiveByEmailKey(ctx, scopeA, 'shared@example.test')).resolves.toEqual(inA);
      await expect(repo.findLiveByEmailKey(ctx, scopeB, 'shared@example.test')).resolves.toEqual(inB);
    });

    it('refuses a second live member with the same email key in one business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, invitedMember(scopeA, { email: 'dup@example.test' }));

      // Act and assert
      await expect(
        repo.insert(ctx, scopeA, invitedMember(scopeA, { email: ' DUP@example.test', emailKey: 'dup@example.test' })),
      ).rejects.toThrow();
    });

    it('frees the email of a removed member for a new invitation in the same business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const first = invitedMember(scopeA, { email: 'again@example.test' });
      await repo.insert(ctx, scopeA, first);
      await repo.update(ctx, scopeA, first.id, { removedAt: T0 });
      const second = invitedMember(scopeA, { email: 'again@example.test' });

      // Act
      await repo.insert(ctx, scopeA, second);

      // Assert
      await expect(repo.findLiveByEmailKey(ctx, scopeA, 'again@example.test')).resolves.toEqual(second);
      await expect(repo.findById(ctx, scopeA, first.id)).resolves.toMatchObject({ removedAt: T0 });
    });

    it('refuses two members holding one administrator account in a business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, invitedMember(scopeA, { status: 'active', administratorId: 43 }));

      // Act and assert
      await expect(
        repo.insert(ctx, scopeA, invitedMember(scopeA, { status: 'active', administratorId: 43 })),
      ).rejects.toThrow();
    });

    it('applies a patch and leaves the other fields as they were', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const member = invitedMember(scopeA);
      await repo.insert(ctx, scopeA, member);
      const joinedAt = new Date(T0.getTime() + 1000);

      // Act
      const changed = await repo.update(ctx, scopeA, member.id, {
        status: 'active',
        administratorId: 44,
        firstName: 'Amina',
        joinedAt,
      });

      // Assert
      expect(changed).toBe(true);
      await expect(repo.findById(ctx, scopeA, member.id)).resolves.toEqual({
        ...member,
        status: 'active',
        administratorId: 44,
        firstName: 'Amina',
        joinedAt,
      });
    });
    it("lists the business's live members only: no removed member, none of another business", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const live = invitedMember(scopeA);
      const active = invitedMember(scopeA, { status: 'active', administratorId: 45 });
      await repo.insert(ctx, scopeA, live);
      await repo.insert(ctx, scopeA, active);
      await repo.insert(ctx, scopeA, invitedMember(scopeA, { removedAt: T0 }));
      await repo.insert(ctx, scopeB, invitedMember(scopeB));

      // Act
      const listed = await repo.listLive(ctx, scopeA);

      // Assert
      expect([...listed].sort((left, right) => left.id.localeCompare(right.id))).toEqual(
        [live, active].sort((left, right) => left.id.localeCompare(right.id)),
      );
    });
  });
}
