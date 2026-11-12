import { asOperationContext as asTenancyContext, GetBusinessService, MemberAccountService } from '@cod/plugin-tenancy';
import { type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { BusinessNamesPort } from '../domain/ports/business-names.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** {@link BusinessNamesPort} on tenancy, which owns the business and its administrators' accounts (D202). */
@Injectable()
export class TenancyBusinessNamesAdapter implements BusinessNamesPort {
  constructor(
    private readonly businesses: GetBusinessService,
    private readonly accounts: MemberAccountService,
  ) {}

  async businessName(ctx: OperationContext, scope: TenantScope): Promise<string> {
    const business = await this.businesses.get(asTenancyContext(toRequestContext(ctx)), scope.businessId);
    return business.name;
  }

  async administratorName(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<string | null> {
    const [profile] = await this.accounts.profilesOf(
      asTenancyContext(toRequestContext(ctx)),
      toSnowflake(scope.businessId),
      [administratorId],
    );
    if (profile === undefined) return null;
    const name = `${profile.firstName} ${profile.lastName}`.trim();
    return name === '' ? profile.emailAddress : name;
  }
}
