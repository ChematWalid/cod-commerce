import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type CreateMemberAccountCommand, MemberAccountService } from '../../application/member-account.service';
import { newBusiness } from '../../domain/business';
import { BusinessNotFoundError, BusinessOwnerProtectedError, MemberNotInBusinessError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import { InMemoryPlatformStore, inlineTransaction } from '../fakes/fakes';
import { InMemoryMemberAccounts } from '../fakes/member-accounts';

const ctx = asOperationContext({});
const NOW = new Date('2026-11-12T10:00:00Z');
const BUSINESS_A = toSnowflake('101');
const BUSINESS_B = toSnowflake('102');
const UNKNOWN_BUSINESS = toSnowflake('999');

const commandFor = (businessId = BUSINESS_A): CreateMemberAccountCommand => ({
  businessId,
  emailAddress: 'member@example.test',
  firstName: 'Synthetic',
  lastName: 'Member',
  password: 'synthetic-member-password',
});

async function setUp(): Promise<{ service: MemberAccountService; accounts: InMemoryMemberAccounts }> {
  const platform = new InMemoryPlatformStore();
  for (const id of [BUSINESS_A, BUSINESS_B]) {
    await platform.saveBusiness(ctx, newBusiness({ id, name: `Business ${id}`, sellerId: Number(id), now: NOW }));
  }
  const accounts = new InMemoryMemberAccounts();
  const service = new MemberAccountService({ accounts, platform, transaction: inlineTransaction });
  return { service, accounts };
}

describe('MemberAccountService', () => {
  it('creates an account tied to the business', async () => {
    // Arrange
    const { service, accounts } = await setUp();

    // Act
    const account = await service.create(ctx, commandFor());

    // Assert
    expect(await accounts.businessIdOf(ctx, account.administratorId)).toBe(BUSINESS_A);
  });

  it('refuses to create an account for a business that does not exist', async () => {
    // Arrange
    const { service, accounts } = await setUp();

    // Act
    const creating = service.create(ctx, commandFor(UNKNOWN_BUSINESS));

    // Assert
    await expect(creating).rejects.toBeInstanceOf(BusinessNotFoundError);
    expect(accounts.accounts.size).toBe(0);
  });

  it('soft-deletes a member of the business', async () => {
    // Arrange
    const { service, accounts } = await setUp();
    const { administratorId } = await service.create(ctx, commandFor());

    // Act
    await service.softDelete(ctx, BUSINESS_A, administratorId);

    // Assert
    expect(await accounts.businessIdOf(ctx, administratorId)).toBeNull();
  });

  it("refuses to soft-delete another business's member", async () => {
    // Arrange
    const { service, accounts } = await setUp();
    const { administratorId } = await service.create(ctx, commandFor(BUSINESS_B));

    // Act
    const deleting = service.softDelete(ctx, BUSINESS_A, administratorId);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(MemberNotInBusinessError);
    expect(await accounts.businessIdOf(ctx, administratorId)).toBe(BUSINESS_B);
  });

  it('refuses to soft-delete an account that does not exist or is already deleted', async () => {
    // Arrange
    const { service } = await setUp();
    const { administratorId } = await service.create(ctx, commandFor());
    await service.softDelete(ctx, BUSINESS_A, administratorId);

    // Act
    const again = service.softDelete(ctx, BUSINESS_A, administratorId);
    const unknown = service.softDelete(ctx, BUSINESS_A, administratorId + 1);

    // Assert
    await expect(again).rejects.toBeInstanceOf(MemberNotInBusinessError);
    await expect(unknown).rejects.toBeInstanceOf(MemberNotInBusinessError);
  });

  it('refuses to soft-delete the business owner', async () => {
    // Arrange
    const platform = new InMemoryPlatformStore();
    const accounts = new InMemoryMemberAccounts();
    const service = new MemberAccountService({ accounts, platform, transaction: inlineTransaction });
    await platform.saveBusiness(ctx, newBusiness({ id: BUSINESS_A, name: 'A', sellerId: 1, now: NOW }));
    const { administratorId } = await service.create(ctx, commandFor());
    await platform.updateBusinessOwner(ctx, BUSINESS_A, { ownerAdministratorId: administratorId });

    // Act
    const deleting = service.softDelete(ctx, BUSINESS_A, administratorId);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(BusinessOwnerProtectedError);
    expect(await accounts.businessIdOf(ctx, administratorId)).toBe(BUSINESS_A);
  });

  it('reads the profiles of live accounts of the business only, in the order asked', async () => {
    // Arrange
    const { service } = await setUp();
    const second = await service.create(ctx, { ...commandFor(), emailAddress: 'second@example.test' });
    const first = await service.create(ctx, commandFor());
    const ofB = await service.create(ctx, { ...commandFor(BUSINESS_B), emailAddress: 'b@example.test' });
    const deleted = await service.create(ctx, { ...commandFor(), emailAddress: 'gone@example.test' });
    await service.softDelete(ctx, BUSINESS_A, deleted.administratorId);
    const ids = [first, second, ofB, deleted].map((account) => account.administratorId);

    // Act
    const profiles = await service.profilesOf(ctx, BUSINESS_A, [...ids, 999]);

    // Assert
    expect(profiles).toEqual([
      {
        administratorId: first.administratorId,
        businessId: BUSINESS_A,
        emailAddress: 'member@example.test',
        firstName: 'Synthetic',
        lastName: 'Member',
      },
      {
        administratorId: second.administratorId,
        businessId: BUSINESS_A,
        emailAddress: 'second@example.test',
        firstName: 'Synthetic',
        lastName: 'Member',
      },
    ]);
  });
});
