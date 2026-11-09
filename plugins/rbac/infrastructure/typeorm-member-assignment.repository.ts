import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Snowflake, TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { MemberAssignment } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { MemberRoleAssignmentEntity } from './member-role-assignment.entity';
import { toRequestContext } from './request-context';

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
