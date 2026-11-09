import { ACTIVITY_ACTIONS, type ActivityAction, type PermissionKey } from '@cod/shared';
import type { BusinessRole } from '../domain/business-role';
import { assertCanCreateRole } from '../domain/escalation-rules';
import type { OperationContext } from '../domain/ports/operation-context';
import { permissionsDiff } from '../domain/role-diff';
import { parseDescription, type RolePermissionChoices, resolvePermissions } from '../domain/role-input';
import { type ParsedRoleName, parseRoleName } from '../domain/role-name';
import { type BusinessRoleView, toRoleView } from '../domain/role-view';
import type { RoleActor, RoleWorld, RoleWriter } from './role-writer';

/** A new role, as the editor describes it (D63). */
export interface CreateRoleCommand extends RolePermissionChoices {
  readonly name: string;
  readonly description: string | null;
  readonly startFromRoleId: string | null;
}

/** The new role a create or a duplicate inserts. */
export interface NewRole extends ParsedRoleName {
  readonly description: string | null;
  readonly permissions: readonly PermissionKey[];
}

/** Inserts a custom role and its activity row, after the rules every new role obeys (D60.1, D71). */
export async function insertCustomRole(
  writer: RoleWriter,
  run: { readonly ctx: OperationContext; readonly actor: RoleActor; readonly world: RoleWorld },
  role: NewRole,
  action: ActivityAction,
): Promise<BusinessRole> {
  const { ctx, actor, world } = run;
  assertCanCreateRole(world.actor, actor.tenant.activeStoreId, role.permissions);
  writer.assertRoomForRole(world);
  const now = writer.ports.clock.now();
  const row: BusinessRole = { ...role, id: writer.ports.ids.next(), builtInKey: null, createdAt: now, updatedAt: now };
  await writer.ports.roles.insert(ctx, actor.tenant, row);
  await writer.record(ctx, actor, {
    action,
    entityId: row.id,
    summary: `Role ${row.name} created`,
    diff: { name: row.name, permissions: permissionsDiff([], row.permissions) },
  });
  return row;
}

/** Creates a custom role (D63). */
export class CreateRoleService {
  constructor(private readonly writer: RoleWriter) {}

  /** @throws a {@link RbacError} for an invalid name or description, an unknown key, or a refusal under D60 */
  create(ctx: OperationContext, actor: RoleActor, command: CreateRoleCommand): Promise<BusinessRoleView> {
    return this.writer.write(ctx, actor, async (transactional, world) => {
      const parsed = parseRoleName(command.name);
      const base =
        command.startFromRoleId === null ? [] : this.writer.requireRole(world, command.startFromRoleId).permissions;
      const role: NewRole = {
        ...parsed,
        description: parseDescription(command.description),
        permissions: resolvePermissions(base, command),
      };
      this.writer.assertNameFree(world, parsed.nameKey);
      const row = await insertCustomRole(
        this.writer,
        { ctx: transactional, actor, world },
        role,
        ACTIVITY_ACTIONS.ROLE_CREATED,
      );
      return { result: toRoleView(row, 0), flush: [] };
    });
  }
}
