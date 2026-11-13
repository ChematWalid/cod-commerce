import { isSnowflake, type Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { type Administrator, AdministratorService, type RequestContext, UserInputError } from '@vendure/core';
import { MemberEmailTakenError } from '../domain/errors';
import type {
  MemberAccount,
  MemberAccountPort,
  MemberAccountRequest,
  MemberProfile,
} from '../domain/ports/member-account.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { SuperadminContextFactory } from './superadmin-context.factory';

/** The message key Vendure raises when a live administrator already holds the address. */
const DUPLICATE_ADMINISTRATOR_EMAIL = 'error.email-address-already-exists-for-administrator';

/** `customFields.businessId` is declared by this plugin's configuration, so Vendure's generated type cannot know it. */
function businessIdOf(administrator: Administrator): Snowflake | null {
  const { businessId } = administrator.customFields as { readonly businessId?: unknown };
  return typeof businessId === 'string' && isSnowflake(businessId) ? businessId : null;
}

const isDuplicateEmail = (error: unknown): boolean =>
  error instanceof UserInputError && error.message === DUPLICATE_ADMINISTRATOR_EMAIL;

/**
 * Member accounts as Vendure administrators. Administrator creation and reads check the active user, but an invitee
 * accepting and an owner removing a member are legitimate callers, so these run as the superadmin (A2), exactly as
 * {@link VendureChannelProvisioner.createAdministrator} does.
 */
@Injectable()
export class VendureMemberAccounts implements MemberAccountPort {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly superadmins: SuperadminContextFactory,
  ) {}

  async create(ctx: OperationContext, request: MemberAccountRequest): Promise<MemberAccount> {
    const { businessId, ...identity } = request;
    try {
      const administrator = await this.administrators.create(await this.superadmin(ctx), {
        ...identity,
        // Explicitly empty: access is rbac's to grant (D204).
        roleIds: [],
        customFields: { businessId },
      });
      return { administratorId: administrator.id as number, userId: administrator.user.id as number };
    } catch (error: unknown) {
      if (isDuplicateEmail(error)) throw new MemberEmailTakenError();
      throw error;
    }
  }

  async businessIdOf(ctx: OperationContext, administratorId: number): Promise<Snowflake | null> {
    const administrator = await this.administrators.findOne(await this.superadmin(ctx), administratorId);
    return administrator === undefined ? null : businessIdOf(administrator);
  }

  async profileOf(ctx: OperationContext, administratorId: number): Promise<MemberProfile | null> {
    const administrator = await this.administrators.findOne(await this.superadmin(ctx), administratorId);
    const businessId = administrator === undefined ? null : businessIdOf(administrator);
    if (administrator === undefined || businessId === null) return null;
    const { emailAddress, firstName, lastName } = administrator;
    return { administratorId, businessId, emailAddress, firstName, lastName };
  }

  async softDelete(ctx: OperationContext, administratorId: number): Promise<void> {
    await this.administrators.softDelete(await this.superadmin(ctx), administratorId);
  }

  private superadmin(ctx: OperationContext): Promise<RequestContext> {
    return this.superadmins.create(ctx);
  }
}
