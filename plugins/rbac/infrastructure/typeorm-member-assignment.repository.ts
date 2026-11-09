import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { MemberAssignment } from '../domain/business-role';
import type { MemberStoreAccess } from '../domain/constants';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { MemberRoleAssignmentEntity } from './member-role-assignment.entity';
import { toRequestContext } from './request-context';

const ALL_STORES_ACCESS: MemberStoreAccess = 'all';

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

  async allStoresAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { storeAccess: ALL_STORES_ACCESS },
    });
    return [...new Set(rows.map((row) => row.administratorId))];
  }
}
