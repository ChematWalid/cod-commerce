import { ACTIVITY_ACTIONS, type PermissionKey } from '@cod/shared';
import type { BusinessRole } from '../domain/business-role';
import { BuiltInImmutableError } from '../domain/errors';
import { assertCanChangeTarget, assertCanEditRole, assertNotEditingHeldRole } from '../domain/escalation-rules';
import type { OperationContext } from '../domain/ports/operation-context';
import { isEmptyDiff, permissionsDiff } from '../domain/role-diff';
import { parseDescription, type RolePermissionChoices, resolvePermissions } from '../domain/role-input';
import { type ParsedRoleName, parseRoleName } from '../domain/role-name';
import { type BusinessRoleView, toRoleView } from '../domain/role-view';
import { buildActor } from '../domain/store-access';
import type { BindingProjector } from './binding-projector.service';
import type { RoleActor, RoleWorld, RoleWriter } from './role-writer';

/** An edit: only what is sent changes, and `null` clears a description (D63). */
export interface UpdateRoleCommand extends RolePermissionChoices {
  readonly id: string;
  readonly name: string | undefined;
  readonly description: string | null | undefined;
  readonly startFromRoleId: string | undefined;
}

interface NextRole extends ParsedRoleName {
  readonly description: string | null;
  readonly permissions: readonly PermissionKey[];
}

/** Edits a custom role and every Vendure Role projecting it (D53, D60, D63). */
export class UpdateRoleService {
  constructor(
    private readonly writer: RoleWriter,
    private readonly projector: Pick<BindingProjector, 'syncPermissions'>,
  ) {}

  /** @throws a {@link RbacError} for a built-in, an invalid input or a refusal under D60 */
  update(ctx: OperationContext, actor: RoleActor, command: UpdateRoleCommand): Promise<BusinessRoleView> {
    return this.writer.write(ctx, actor, async (transactional, world) => {
      const role = this.writer.requireRole(world, command.id);
      if (role.builtInKey !== null) throw new BuiltInImmutableError();
      const next = this.nextOf(world, role, command);
      await this.assertAllowed(transactional, actor, world, { role, next });
      this.writer.assertNameFree(world, next.nameKey, role.id);
      const holders = await this.writer.ports.assignments.holdersOf(transactional, actor.tenant, [role.id]);
      const updated = await this.apply(transactional, actor, world, { role, next });
      const permissionsChanged = !isEmptyDiff(permissionsDiff(role.permissions, next.permissions));
      return { result: toRoleView(updated, holders.length), flush: permissionsChanged ? holders : [] };
    });
  }

  /** On update the base is the role's current permissions, and `startFromRoleId` replaces it only when sent (D63). */
  private nextOf(world: RoleWorld, role: BusinessRole, command: UpdateRoleCommand): NextRole {
    const base =
      command.startFromRoleId === undefined
        ? role.permissions
        : this.writer.requireRole(world, command.startFromRoleId).permissions;
    return {
      ...(command.name === undefined ? { name: role.name, nameKey: role.nameKey } : parseRoleName(command.name)),
      description: command.description === undefined ? role.description : parseDescription(command.description),
      permissions: resolvePermissions(base, command),
    };
  }

  private async assertAllowed(
    ctx: OperationContext,
    actor: RoleActor,
    world: RoleWorld,
    { role, next }: { readonly role: BusinessRole; readonly next: NextRole },
  ): Promise<void> {
    const holdsRole = await this.writer.ports.assignments.isAssigned(ctx, actor.tenant, actor.administratorId, role.id);
    assertNotEditingHeldRole(world.actor, holdsRole);
    assertCanEditRole(world.actor, this.writer.editOf(world, actor, role, next.permissions));
    if (!isEmptyDiff(permissionsDiff(role.permissions, next.permissions))) {
      await this.assertHoldersWithinActor(ctx, actor, world, role);
    }
  }

  /** D60.4 for everyone the edit affects, so nobody changes what a superior can do. A rename affects nobody. */
  private async assertHoldersWithinActor(
    ctx: OperationContext,
    actor: RoleActor,
    world: RoleWorld,
    role: BusinessRole,
  ): Promise<void> {
    const { assignments } = this.writer.ports;
    const roles = new Map(world.roles.map((row) => [row.id as string, row]));
    for (const holder of await assignments.holdersOf(ctx, actor.tenant, [role.id])) {
      const rows = await assignments.ofAdministrator(ctx, actor.tenant, holder);
      assertCanChangeTarget(world.actor, buildActor(holder, rows, roles, world.activeStoreIds));
    }
  }

  /** An edit that changes nothing writes nothing and logs nothing. */
  private async apply(
    ctx: OperationContext,
    actor: RoleActor,
    world: RoleWorld,
    { role, next }: { readonly role: BusinessRole; readonly next: NextRole },
  ): Promise<BusinessRole> {
    const diff = permissionsDiff(role.permissions, next.permissions);
    const unchanged = isEmptyDiff(diff) && next.name === role.name && next.description === role.description;
    if (unchanged) return role;
    const updated: BusinessRole = { ...role, ...next, updatedAt: this.writer.ports.clock.now() };
    const { name, nameKey, description, permissions, updatedAt } = updated;
    await this.writer.ports.roles.update(ctx, actor.tenant, role.id, {
      name,
      nameKey,
      description,
      permissions,
      updatedAt,
    });
    if (!isEmptyDiff(diff)) await this.projector.syncPermissions(ctx, updated, this.writer.bindingsOf(world, role.id));
    await this.writer.record(ctx, actor, {
      action: ACTIVITY_ACTIONS.ROLE_UPDATED,
      entityId: role.id,
      summary: `Role ${updated.name} updated`,
      diff: {
        name: { before: role.name, after: updated.name },
        description: { before: role.description, after: updated.description },
        permissions: diff,
      },
    });
    return updated;
  }
}
