import { BUILT_IN_ROLES, type BusinessId } from '@cod/shared';
import { type BusinessRole, newBuiltInRole } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';

/** What seeding writes through. */
export interface SeedBuiltInRolesPorts {
  readonly lock: RbacLockPort;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'insert'>;
  readonly bindings: Pick<RoleBindingRepositoryPort, 'insert'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'insert'>;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}

/** The new business whose roles to seed; tenancy has already made its Owner Vendure Role and first administrator. */
export interface SeedBuiltInRolesCommand {
  readonly businessId: BusinessId;
  readonly ownerRoleId: number;
  readonly ownerAdministratorId: number;
}

/** Gives a business its seven built-in roles (D56, D61). */
export class SeedBuiltInRolesService {
  constructor(private readonly ports: SeedBuiltInRolesPorts) {}

  /** Writes in the transaction `ctx` carries, so a failure undoes the provisioning with it (D56). */
  async seed(ctx: OperationContext, command: SeedBuiltInRolesCommand): Promise<void> {
    const { lock, roles, ids, clock } = this.ports;
    await lock.acquire(ctx, command.businessId);
    const now = clock.now();
    const scope = { businessId: command.businessId };
    const rows = BUILT_IN_ROLES.map((template) => newBuiltInRole(template, ids.next(), now));
    for (const row of rows) {
      await roles.insert(ctx, scope, row);
    }
    await this.bindOwner(ctx, command, this.ownerOf(rows), now);
  }

  private ownerOf(rows: readonly BusinessRole[]): BusinessRole {
    const owner = rows.find((row) => row.builtInKey === 'owner');
    if (owner === undefined) throw new Error('The built-in templates have no owner role');
    return owner;
  }

  private async bindOwner(
    ctx: OperationContext,
    { businessId, ownerRoleId, ownerAdministratorId }: SeedBuiltInRolesCommand,
    owner: BusinessRole,
    now: Date,
  ): Promise<void> {
    const { bindings, assignments, ids } = this.ports;
    await bindings.insert(
      ctx,
      { businessId },
      { id: ids.next(), businessRoleId: owner.id, scope: ALL_STORES_SCOPE, vendureRoleId: ownerRoleId },
    );
    await assignments.insert(
      ctx,
      { businessId },
      {
        id: ids.next(),
        administratorId: ownerAdministratorId,
        businessRoleId: owner.id,
        storeAccess: ALL_STORES_SCOPE,
        storeIds: [],
        createdAt: now,
      },
    );
  }
}
