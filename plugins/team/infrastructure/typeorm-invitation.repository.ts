import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import type { Invitation, IssuedInvitation } from '../domain/invitation';
import type { InvitationPatch, InvitationRepositoryPort } from '../domain/ports/invitation-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { InvitationEntity } from './invitation.entity';
import { requestScope } from './request-scope';

function toInvitation(row: InvitationEntity): Invitation {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    memberId: toSnowflake(row.memberId),
    grant: {
      roleIds: row.grant.roleIds.map(toSnowflake),
      storeAccess: row.grant.storeAccess,
      storeIds: row.grant.storeIds.map(toSnowflake),
    },
    locale: row.locale,
    expiresAt: row.expiresAt,
    lastSentAt: row.lastSentAt,
    resendCount: row.resendCount,
    invitedByAdministratorId: row.invitedByAdministratorId,
    revokedAt: row.revokedAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
  };
}

/**
 * The Postgres adapter of {@link InvitationRepositoryPort}, on `TenantRepository` (ADR 0002). Its reads never select
 * the token hash (`select: false` on the column).
 */
@Injectable()
export class TypeOrmInvitationRepository implements InvitationRepositoryPort {
  private readonly rows: TenantRepository<InvitationEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(InvitationEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, invitation: IssuedInvitation): Promise<void> {
    const { grant } = invitation;
    await this.rows.insert(requestScope(ctx, scope), {
      ...invitation,
      grant: { roleIds: [...grant.roleIds], storeAccess: grant.storeAccess, storeIds: [...grant.storeIds] },
    });
  }

  async findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<Invitation | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id });
    return row === null ? undefined : toInvitation(row);
  }

  async latestOfMember(
    ctx: OperationContext,
    scope: TenantScope,
    memberId: Snowflake,
  ): Promise<Invitation | undefined> {
    const [row] = await this.rows.find(requestScope(ctx, scope), {
      where: { memberId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 1,
    });
    return row === undefined ? undefined : toInvitation(row);
  }

  /** One conditional `UPDATE`: Postgres re-checks the condition after a parallel claim commits, so one wins (D213). */
  async claim(ctx: OperationContext, scope: TenantScope, tokenHash: string, now: Date): Promise<boolean> {
    const changed = await this.rows.update(
      requestScope(ctx, scope),
      { tokenHash, acceptedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(now) },
      { acceptedAt: now },
    );
    return changed > 0;
  }

  countOpen(ctx: OperationContext, scope: TenantScope, now: Date): Promise<number> {
    return this.rows.count(requestScope(ctx, scope), {
      acceptedAt: IsNull(),
      revokedAt: IsNull(),
      expiresAt: MoreThan(now),
    });
  }

  async update(ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: InvitationPatch): Promise<boolean> {
    const changed = await this.rows.update(requestScope(ctx, scope), { id }, patch);
    return changed > 0;
  }
}
