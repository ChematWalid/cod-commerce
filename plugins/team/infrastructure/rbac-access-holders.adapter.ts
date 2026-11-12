import { asOperationContext as asRbacContext, MemberAccessService } from '@cod/plugin-rbac/member-access';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { AccessHoldersPort } from '../domain/ports/access-holders.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** {@link AccessHoldersPort} on rbac's member access, the one source of truth for who holds a role (D204). */
@Injectable()
export class RbacAccessHoldersAdapter implements AccessHoldersPort {
  constructor(private readonly access: MemberAccessService) {}

  administratorIdsOf(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    return this.access.memberAdministratorIds(asRbacContext(toRequestContext(ctx)), scope);
  }
}
