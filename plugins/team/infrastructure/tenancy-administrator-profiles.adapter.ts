import { asOperationContext as asTenancyContext, MemberAccountService } from '@cod/plugin-tenancy';
import { type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { AdministratorProfile } from '../domain/administrator-profile';
import type { AdministratorProfilesPort } from '../domain/ports/administrator-profiles.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** {@link AdministratorProfilesPort} on tenancy's member accounts, which own the account's business link (D202). */
@Injectable()
export class TenancyAdministratorProfilesAdapter implements AdministratorProfilesPort {
  constructor(private readonly accounts: MemberAccountService) {}

  async profilesOf(
    ctx: OperationContext,
    scope: TenantScope,
    administratorIds: readonly number[],
  ): Promise<readonly AdministratorProfile[]> {
    const profiles = await this.accounts.profilesOf(
      asTenancyContext(toRequestContext(ctx)),
      toSnowflake(scope.businessId),
      administratorIds,
    );
    return profiles.map(({ administratorId, emailAddress, firstName, lastName }) => ({
      administratorId,
      email: emailAddress,
      firstName,
      lastName,
    }));
  }
}
