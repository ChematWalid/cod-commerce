import { type UpdateAccountProfileInput, updateAccountProfileSchema } from '@cod/shared';
import { ProfileInvalidError, ProfileMissingError } from '../domain/errors';
import type { AccountProfileStorePort } from '../domain/ports/account-profile.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountProfile } from '../domain/profile';

/** What a profile save may leave out: a field that is absent keeps its value. */
export type ProfileUpdate = { readonly [K in keyof UpdateAccountProfileInput]?: UpdateAccountProfileInput[K] };

/** The owner's own profile. Every method takes the signed-in user from the caller's session, never from a request. */
export class AccountProfileService {
  constructor(private readonly store: AccountProfileStorePort) {}

  /** @throws ProfileMissingError when the user has no administrator. */
  async get(ctx: OperationContext, userId: number): Promise<AccountProfile> {
    const profile = await this.store.find(ctx, userId);
    if (profile === undefined) {
      throw new ProfileMissingError();
    }
    return profile;
  }

  /**
   * Saves the names and the phone (E.164). An absent field is kept; `null` or an empty phone clears it.
   *
   * @throws ProfileInvalidError naming the fields that fail the shared schema.
   */
  async update(ctx: OperationContext, userId: number, update: ProfileUpdate): Promise<AccountProfile> {
    const current = await this.get(ctx, userId);
    const parsed = updateAccountProfileSchema.safeParse({
      firstName: update.firstName ?? current.firstName,
      lastName: update.lastName ?? current.lastName,
      phone: update.phone === undefined ? current.phone : update.phone,
    });
    if (!parsed.success) {
      throw new ProfileInvalidError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'input')))]);
    }
    await this.store.save(ctx, userId, parsed.data);
    return { ...current, ...parsed.data };
  }
}
