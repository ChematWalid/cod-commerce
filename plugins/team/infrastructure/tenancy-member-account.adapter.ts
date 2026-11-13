import {
  asOperationContext as asAuthContext,
  EmailTakenError,
  InvitedAccountService,
} from '@cod/plugin-auth/invitations';
import {
  asOperationContext as asTenancyContext,
  MemberAccountService,
  MemberEmailTakenError,
} from '@cod/plugin-tenancy';
import { type TeamEmailLocale, type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AccountElsewhereError } from '../domain/errors';
import type { MemberAccountPort, NewMemberAccount } from '../domain/ports/member-account.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** Postgres' code for a unique violation: a parallel accept took the address first. */
const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === UNIQUE_VIOLATION;

/** Every way the platform says "this address already has an account" becomes one Team refusal (D201, D213). */
function accountElsewhereOr(error: unknown): unknown {
  const taken = error instanceof EmailTakenError || error instanceof MemberEmailTakenError || isUniqueViolation(error);
  return taken ? new AccountElsewhereError() : error;
}

/**
 * {@link MemberAccountPort} on tenancy's member accounts (the administrator and its business link, D202) and auth's
 * invited accounts (the address claim and its proof, D203).
 */
@Injectable()
export class TenancyMemberAccountAdapter implements MemberAccountPort {
  constructor(
    private readonly accounts: MemberAccountService,
    private readonly invited: InvitedAccountService,
  ) {}

  async assertEmailFree(ctx: OperationContext, email: string): Promise<void> {
    try {
      await this.invited.assertEmailFree(asAuthContext(toRequestContext(ctx)), email);
    } catch (error: unknown) {
      throw accountElsewhereOr(error);
    }
  }

  async create(ctx: OperationContext, scope: TenantScope, account: NewMemberAccount): Promise<number> {
    try {
      const created = await this.accounts.create(asTenancyContext(toRequestContext(ctx)), {
        businessId: toSnowflake(scope.businessId),
        emailAddress: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        password: account.password,
      });
      return created.administratorId;
    } catch (error: unknown) {
      throw accountElsewhereOr(error);
    }
  }

  markVerified(ctx: OperationContext, administratorId: number, locale: TeamEmailLocale): Promise<void> {
    return this.invited.markInvitedVerified(asAuthContext(toRequestContext(ctx)), administratorId, locale);
  }

  softDelete(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<void> {
    return this.accounts.softDelete(
      asTenancyContext(toRequestContext(ctx)),
      toSnowflake(scope.businessId),
      administratorId,
    );
  }
}
