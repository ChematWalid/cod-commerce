import { describe, expect, it } from 'vitest';
import { AccountProfileService } from '../../application/account-profile.service';
import { ProfileInvalidError, ProfileMissingError } from '../../domain/errors';
import type { AccountProfileStorePort } from '../../domain/ports/account-profile.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { AccountProfile, ProfileChange } from '../../domain/profile';

const ctx = {} as OperationContext;
const USER = 7;

const initial: AccountProfile = {
  firstName: 'Sara',
  lastName: 'Owner',
  emailAddress: 'sara@example.test',
  phone: '+213555000111',
  avatarUrl: null,
  emailVerified: true,
};

class MemoryProfiles implements AccountProfileStorePort {
  readonly saves: ProfileChange[] = [];

  constructor(private readonly current: AccountProfile | null = initial) {}

  find(): Promise<AccountProfile | undefined> {
    return Promise.resolve(this.current ?? undefined);
  }

  save(_ctx: OperationContext, _userId: number, change: ProfileChange): Promise<void> {
    this.saves.push(change);
    return Promise.resolve();
  }
}

describe('AccountProfileService', () => {
  it('saves a national phone as E.164 and trims the names', async () => {
    // Arrange
    const store = new MemoryProfiles();

    // Act
    const saved = await new AccountProfileService(store).update(ctx, USER, {
      firstName: ' Nadia ',
      lastName: 'Haddad',
      phone: '0555123456',
    });

    // Assert
    expect(store.saves).toEqual([{ firstName: 'Nadia', lastName: 'Haddad', phone: '+213555123456' }]);
    expect(saved).toMatchObject({ firstName: 'Nadia', phone: '+213555123456', emailAddress: 'sara@example.test' });
  });

  it('keeps what the update leaves out, and clears the phone on null', async () => {
    // Arrange
    const store = new MemoryProfiles();
    const service = new AccountProfileService(store);

    // Act
    await service.update(ctx, USER, { lastName: 'Haddad' });
    await service.update(ctx, USER, { phone: null });

    // Assert
    expect(store.saves).toEqual([
      { firstName: 'Sara', lastName: 'Haddad', phone: '+213555000111' },
      { firstName: 'Sara', lastName: 'Owner', phone: null },
    ]);
  });

  it('names the failing fields, never their values, and saves nothing', async () => {
    // Arrange
    const store = new MemoryProfiles();

    // Act
    const update = new AccountProfileService(store).update(ctx, USER, { firstName: '  ', phone: 'private-looking' });

    // Assert
    await expect(update).rejects.toThrow(new ProfileInvalidError(['firstName', 'phone']));
    expect(store.saves).toEqual([]);
  });

  it('fails on a user with no administrator', async () => {
    await expect(new AccountProfileService(new MemoryProfiles(null)).get(ctx, USER)).rejects.toBeInstanceOf(
      ProfileMissingError,
    );
  });
});
