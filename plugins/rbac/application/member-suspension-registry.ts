import type { TenantScope } from '@cod/shared';
import type { MemberSuspensionCheck } from '../domain/ports/member-suspension.port';
import type { OperationContext } from '../domain/ports/operation-context';

/**
 * The checks other plugins register, as one {@link MemberSuspensionCheck} (D204). With none registered nobody is
 * suspended. A plugin registers from its own module, since rbac's providers cannot be replaced from outside it.
 */
export class MemberSuspensionRegistry implements MemberSuspensionCheck {
  private readonly checks: MemberSuspensionCheck[] = [];

  /** Adds a check; a member is suspended when any registered check says so. */
  register(check: MemberSuspensionCheck): void {
    this.checks.push(check);
  }

  async isSuspended(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<boolean> {
    for (const check of this.checks) {
      if (await check.isSuspended(ctx, scope, administratorId)) return true;
    }
    return false;
  }
}
