import { INVITATION_TTL_MS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { Invitation, IssuedInvitation } from '../../domain/invitation';
import type { InvitationRepositoryPort } from '../../domain/ports/invitation-repository.port';
import { invitedMember, openInvitation, scopeA, scopeB, T0 } from '../support/builders';
import type { MakeHarness } from './repository-harness';

let nextHash = 1;

/** An open invitation of a new member of `scope`, with a token hash no other case uses. */
function issued(scope: typeof scopeA, overrides: Partial<IssuedInvitation> = {}): IssuedInvitation {
  const tokenHash = (nextHash++).toString(16).padStart(64, 'c');
  return openInvitation(invitedMember(scope), { tokenHash, ...overrides });
}

/** What a read gives back: the invitation without its token hash (D205). */
function asRead(invitation: IssuedInvitation): Invitation {
  const entries = Object.entries(invitation).filter(([key]) => key !== 'tokenHash');
  return Object.fromEntries(entries) as unknown as Invitation;
}

/** The behaviour every {@link InvitationRepositoryPort} adapter must have, tenant isolation included. */
export function describeInvitationRepositoryContract(name: string, make: MakeHarness<InvitationRepositoryPort>): void {
  describe(`${name} (InvitationRepositoryPort contract)`, () => {
    it('finds a saved invitation with its grant, but never returns the token hash', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const invitation = issued(scopeA);

      // Act
      await repo.insert(ctx, scopeA, invitation);
      const found = await repo.findById(ctx, scopeA, invitation.id);

      // Assert
      expect(found).toEqual(asRead(invitation));
      expect(found).not.toHaveProperty('tokenHash');
    });

    it("never finds, counts or changes another business's invitation", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const invitationOfA = issued(scopeA);
      await repo.insert(ctx, scopeA, invitationOfA);

      // Act
      const changed = await repo.update(ctx, scopeB, invitationOfA.id, { revokedAt: T0 });

      // Assert
      expect(changed).toBe(false);
      await expect(repo.findById(ctx, scopeB, invitationOfA.id)).resolves.toBeUndefined();
      await expect(repo.latestOfMember(ctx, scopeB, invitationOfA.memberId)).resolves.toBeUndefined();
      await expect(repo.countOpen(ctx, scopeB, T0)).resolves.toBe(0);
      await expect(repo.findById(ctx, scopeA, invitationOfA.id)).resolves.toEqual(asRead(invitationOfA));
    });

    it('refuses a token hash already stored, even in another business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const first = issued(scopeA);
      await repo.insert(ctx, scopeA, first);

      // Act and assert
      await expect(repo.insert(ctx, scopeB, issued(scopeB, { tokenHash: first.tokenHash }))).rejects.toThrow();
    });

    it("gives a member's most recent invitation", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const older = issued(scopeA);
      const newer = issued(scopeA, { memberId: older.memberId, createdAt: new Date(T0.getTime() + 1000) });
      await repo.insert(ctx, scopeA, newer);
      await repo.insert(ctx, scopeA, older);

      // Act
      const latest = await repo.latestOfMember(ctx, scopeA, older.memberId);

      // Assert
      expect(latest).toEqual(asRead(newer));
    });

    it('counts only the open invitations of the business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const expiresSoon = new Date(T0.getTime() + 1000);
      for (const invitation of [
        issued(scopeA),
        issued(scopeA),
        issued(scopeA, { revokedAt: T0 }),
        issued(scopeA, { acceptedAt: T0 }),
        issued(scopeA, { expiresAt: expiresSoon }),
      ]) {
        await repo.insert(ctx, scopeA, invitation);
      }

      // Act
      const open = await repo.countOpen(ctx, scopeA, expiresSoon);

      // Assert
      expect(open).toBe(2);
    });

    it('claims an open invitation by its token hash once, so a second accept finds nothing to claim', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const invitation = issued(scopeA);
      await repo.insert(ctx, scopeA, invitation);
      const now = new Date(T0.getTime() + 1000);

      // Act
      const first = await repo.claim(ctx, scopeA, invitation.tokenHash, now);
      const second = await repo.claim(ctx, scopeA, invitation.tokenHash, now);

      // Assert
      expect([first, second]).toEqual([true, false]);
      await expect(repo.findById(ctx, scopeA, invitation.id)).resolves.toEqual({
        ...asRead(invitation),
        acceptedAt: now,
      });
    });

    it('claims no revoked or expired invitation, none of another business and none under another hash', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const revoked = issued(scopeA, { revokedAt: T0 });
      const expired = issued(scopeA, { expiresAt: T0 });
      const ofB = issued(scopeB);
      for (const [scope, invitation] of [
        [scopeA, revoked],
        [scopeA, expired],
        [scopeB, ofB],
      ] as const) {
        await repo.insert(ctx, scope, invitation);
      }

      // Act
      const claims = [
        await repo.claim(ctx, scopeA, revoked.tokenHash, T0),
        await repo.claim(ctx, scopeA, expired.tokenHash, T0),
        await repo.claim(ctx, scopeA, ofB.tokenHash, T0),
        await repo.claim(ctx, scopeA, 'e'.repeat(64), T0),
      ];

      // Assert
      expect(claims).toEqual([false, false, false, false]);
      await expect(repo.findById(ctx, scopeB, ofB.id)).resolves.toEqual(asRead(ofB));
    });

    it('applies a resend patch', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const invitation = issued(scopeA);
      await repo.insert(ctx, scopeA, invitation);
      const sentAgain = new Date(T0.getTime() + 120_000);
      const visible = {
        lastSentAt: sentAgain,
        expiresAt: new Date(sentAgain.getTime() + INVITATION_TTL_MS),
        resendCount: 1,
      };

      // Act
      const changed = await repo.update(ctx, scopeA, invitation.id, { ...visible, tokenHash: 'd'.repeat(64) });

      // Assert
      expect(changed).toBe(true);
      await expect(repo.findById(ctx, scopeA, invitation.id)).resolves.toEqual({ ...asRead(invitation), ...visible });
    });
  });
}
