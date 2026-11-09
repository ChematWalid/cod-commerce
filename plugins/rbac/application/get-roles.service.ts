import type { TenantScope } from '@cod/shared';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { type BusinessRoleView, toRoleView } from '../domain/role-view';

/** Reads the roles of a business with their member counts. */
export class GetRolesService {
  constructor(
    private readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>,
    private readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofRoles'>,
  ) {}

  /** Every role of the business. */
  async list(ctx: OperationContext, scope: TenantScope): Promise<readonly BusinessRoleView[]> {
    const roles = await this.roles.all(ctx, scope);
    const rows = await this.assignments.ofRoles(
      ctx,
      scope,
      roles.map((role) => role.id),
    );
    const counts = new Map<string, number>();
    for (const { businessRoleId } of rows) counts.set(businessRoleId, (counts.get(businessRoleId) ?? 0) + 1);
    return roles.map((role) => toRoleView(role, counts.get(role.id) ?? 0));
  }

  /** The role, or `undefined` when the id names none of this business. */
  async get(ctx: OperationContext, scope: TenantScope, id: string): Promise<BusinessRoleView | undefined> {
    return (await this.list(ctx, scope)).find((role) => role.id === id);
  }
}
