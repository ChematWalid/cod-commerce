import { ACTIVITY_ACTIONS } from '@cod/shared';
import { BuiltInImmutableError, RoleInUseError } from '../domain/errors';
import { assertCanEditRole } from '../domain/escalation-rules';
import type { OperationContext } from '../domain/ports/operation-context';
import { permissionsDiff } from '../domain/role-diff';
import type { BindingProjector } from './binding-projector.service';
import type { RoleActor, RoleWriter } from './role-writer';

/** Deletes an unassigned custom role with all its bindings and Vendure Roles (D53). */
export class DeleteRoleService {
  constructor(
    private readonly writer: RoleWriter,
    private readonly projector: Pick<BindingProjector, 'removeBindings'>,
  ) {}

  /** @throws a {@link RbacError} for a built-in, a role in use or a refusal under D60 */
  delete(ctx: OperationContext, actor: RoleActor, id: string): Promise<void> {
    return this.writer.write(ctx, actor, async (transactional, world) => {
      const { ports } = this.writer;
      const role = this.writer.requireRole(world, id);
      if (role.builtInKey !== null) throw new BuiltInImmutableError();
      assertCanEditRole(world.actor, this.writer.editOf(world, actor, role, role.permissions));
      if ((await ports.assignments.holdersOf(transactional, actor.tenant, [role.id])).length > 0)
        throw new RoleInUseError();
      await this.projector.removeBindings(transactional, actor.tenant, this.writer.bindingsOf(world, role.id));
      await ports.roles.delete(transactional, actor.tenant, role.id);
      await this.writer.record(transactional, actor, {
        action: ACTIVITY_ACTIONS.ROLE_DELETED,
        entityId: role.id,
        summary: `Role ${role.name} deleted`,
        diff: { name: role.name, permissions: permissionsDiff(role.permissions, []) },
      });
      return { result: undefined, flush: [] };
    });
  }
}
