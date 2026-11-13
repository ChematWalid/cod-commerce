import type { TenantScope } from '@cod/shared';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';

/**
 * Tells rbac which administrators Team deactivated (D204): rbac then refuses to grant them roles, so a role grant
 * cannot silently undo a deactivation.
 */
export class TeamSuspensionCheck {
  constructor(private readonly members: Pick<MemberRepositoryPort, 'findByAdministratorId'>) {}

  async isSuspended(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<boolean> {
    const member = await this.members.findByAdministratorId(ctx, scope, administratorId);
    return member?.status === 'inactive';
  }
}
