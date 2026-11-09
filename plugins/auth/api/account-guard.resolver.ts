import { normalizeEmail } from '@cod/shared';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  type Administrator,
  AdministratorService,
  Allow,
  Ctx,
  ForbiddenError,
  Permission,
  type RequestContext,
  Transaction,
} from '@vendure/core';
import { UseAccountSecurityError } from './use-account-security.error';

/** The stock `UpdateActiveAdministratorInput`. */
interface ActiveAdministratorInput {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly emailAddress?: string | null;
  readonly password?: string | null;
  readonly customFields?: Record<string, unknown> | null;
}

interface ProfileChanges {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly customFields?: Record<string, unknown>;
}

/** A different email or any password; the stock page sends an empty password when the field is left blank. */
function changesCredentials(input: ActiveAdministratorInput, currentEmail: string): boolean {
  const email = input.emailAddress ?? '';
  return (email !== '' && normalizeEmail(email) !== normalizeEmail(currentEmail)) || (input.password ?? '') !== '';
}

/** The fields a profile save may write, without the ones the caller left out. */
function profileChanges(input: ActiveAdministratorInput): ProfileChanges {
  const { firstName, lastName, customFields } = input;
  return {
    ...(firstName == null ? {} : { firstName }),
    ...(lastName == null ? {} : { lastName }),
    ...(customFields == null ? {} : { customFields }),
  };
}

/**
 * Shadows the stock `updateActiveAdministrator` (D21, D38), which changes the email and password with no check
 * of the current password. The stock profile page always posts the email, so an unchanged one must pass.
 */
@Resolver()
export class AccountGuardResolver {
  constructor(private readonly administrators: AdministratorService) {}

  /** Saves the caller's name; a different email or any password is refused. */
  @Transaction()
  @Mutation()
  @Allow(Permission.Owner)
  async updateActiveAdministrator(
    @Ctx() ctx: RequestContext,
    @Args('input') input: ActiveAdministratorInput,
  ): Promise<Administrator> {
    const administrator = await this.activeAdministrator(ctx);
    if (changesCredentials(input, administrator.emailAddress)) {
      throw new UseAccountSecurityError();
    }
    return this.administrators.update(ctx, { id: administrator.id, ...profileChanges(input) });
  }

  private async activeAdministrator(ctx: RequestContext): Promise<Administrator> {
    const { activeUserId } = ctx;
    const administrator =
      activeUserId === undefined ? undefined : await this.administrators.findOneByUserId(ctx, activeUserId);
    if (administrator === undefined) {
      throw new ForbiddenError();
    }
    return administrator;
  }
}
