import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { MemberAssignment } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { MemberRoleAssignmentEntity } from './member-role-assignment.entity';
import { toRequestContext } from './request-context';

function toAssignment(row: MemberRoleAssignmentEntity): MemberAssignment {
  return {
    id: toSnowflake(row.id),
    administratorId: row.administratorId,
    businessRoleId: toSnowflake(row.businessRoleId),
    storeAccess: row.storeAccess,
    storeIds: row.storeIds.map(toSnowflake),
    createdAt: row.createdAt,
  };
}

/** The Postgres adapter of {@link MemberAssignmentRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmMemberAssignmentRepository implements MemberAssignmentRepositoryPort {
  private readonly rows: TenantRepository<MemberRoleAssignmentEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(MemberRoleAssignmentEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, assignment: MemberAssignment): Promise<void> {
    await this.rows.insert(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      ...assignment,
      storeIds: [...assignment.storeIds],
    });
  }

  async isAssigned(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    businessRoleId: Snowflake,
  ): Promise<boolean> {
    const count = await this.rows.count(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      administratorId,
      businessRoleId,
    });
    return count > 0;
  }

  async ofAdministrator(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<readonly MemberAssignment[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { administratorId },
    });
    return rows.map(toAssignment);
  }

  async ofRoles(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly MemberAssignment[]> {
    if (businessRoleIds.length === 0) return [];
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { businessRoleId: In([...businessRoleIds]) },
    });
    return rows.map(toAssignment);
  }

  async replaceFor(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    assignments: readonly MemberAssignment[],
  ): Promise<void> {
    await this.rows.delete(new RequestTenantScope(toRequestContext(ctx), scope.businessId), { administratorId });
    for (const assignment of assignments) {
      await this.insert(ctx, scope, assignment);
    }
  }

  async holdersOf(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly number[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { businessRoleId: In([...businessRoleIds]) },
    });
    return [...new Set(rows.map((row) => row.administratorId))];
  }

  async allStoresAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { storeAccess: ALL_STORES_SCOPE },
    });
    return [...new Set(rows.map((row) => row.administratorId))];
  }
}
