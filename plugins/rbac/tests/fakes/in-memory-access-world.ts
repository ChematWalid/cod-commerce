import type { TenantScope } from '@cod/shared';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import type { BusinessDirectoryPort } from '../../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../../domain/ports/business-role-repository.port';
import type { MemberAssignmentRepositoryPort } from '../../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { BusinessStore } from '../../domain/store-access';

/** One business's stores, roles and member rows, read the way the access rules read them. */
export interface AccessWorldRows {
  readonly stores: readonly BusinessStore[];
  readonly roles: readonly BusinessRole[];
  readonly assignments: readonly MemberAssignment[];
  readonly ownerAdministratorId?: number;
}

/** The read ports of the access rules over fixed rows. */
export class InMemoryAccessWorld {
  readonly directory: Pick<BusinessDirectoryPort, 'stores' | 'ownerAdministratorOf'>;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator'>;

  constructor(rows: AccessWorldRows) {
    this.directory = {
      stores: () => Promise.resolve(rows.stores),
      ownerAdministratorOf: () => Promise.resolve(rows.ownerAdministratorId ?? null),
    };
    this.roles = { all: () => Promise.resolve(rows.roles) };
    this.assignments = {
      ofAdministrator: (_ctx: OperationContext, _scope: TenantScope, administratorId: number) =>
        Promise.resolve(rows.assignments.filter((row) => row.administratorId === administratorId)),
    };
  }
}
