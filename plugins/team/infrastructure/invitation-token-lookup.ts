import { toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { InvitationLocation, InvitationLookupPort } from '../domain/ports/invitation-lookup.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { InvitationEntity } from './invitation.entity';
import { toRequestContext } from './request-scope';

/**
 * The one unscoped read of Team (D208), allow-listed in the raw data access rule: the public accept and preview
 * routes know a token, not a business. It returns where the invitation lives and nothing else; every later read and
 * write runs in that business. RLS (P10.S2) must keep this lookup as an explicit exception (ADR 0002).
 */
@Injectable()
export class InvitationTokenLookup implements InvitationLookupPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async locate(ctx: OperationContext, tokenHash: string): Promise<InvitationLocation | undefined> {
    const row = await this.connection
      .getRepository(toRequestContext(ctx), InvitationEntity)
      .findOne({ select: { id: true, businessId: true }, where: { tokenHash } });
    return row === null ? undefined : { businessId: toBusinessId(row.businessId), invitationId: toSnowflake(row.id) };
  }
}
