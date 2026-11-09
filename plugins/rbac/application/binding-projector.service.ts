import type { Snowflake, TenantScope } from '@cod/shared';
import type { BusinessRole, MemberAssignment, RoleBinding } from '../domain/business-role';
import { ALL_STORES_SCOPE, type BindingScope, ENGINE_BASE_PERMISSION, vendureRoleCode } from '../domain/constants';
import { enginePermissionsFor } from '../domain/engine-grants';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';
import type { BusinessStore } from '../domain/store-access';

/** What projecting reads and writes through. */
export interface BindingProjectorPorts {
  readonly bindings: Pick<RoleBindingRepositoryPort, 'allBindings' | 'insert' | 'delete'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofRoles'>;
  readonly engine: Pick<EngineRolesPort, 'createRole' | 'deleteRole' | 'ownerPermissions'>;
  readonly directory: Pick<BusinessDirectoryPort, 'stores'>;
  readonly ids: IdGeneratorPort;
}

/** A role a member is to hold, and on which stores. */
export interface ProjectedAssignment {
  readonly role: BusinessRole;
  readonly storeAccess: MemberAssignment['storeAccess'];
  readonly storeIds: readonly string[];
}

/** One projection: what exists so far, so a binding is created once however many assignments need it. */
interface Projection {
  readonly ctx: OperationContext;
  readonly scope: TenantScope;
  readonly stores: readonly BusinessStore[];
  readonly existing: RoleBinding[];
}

const selectedPairs = (rows: readonly MemberAssignment[]): readonly (readonly [Snowflake, Snowflake])[] =>
  rows
    .filter((row) => row.storeAccess === 'selected')
    .flatMap((row) => row.storeIds.map((storeId) => [row.businessRoleId, storeId] as const));

/**
 * Projects business roles onto Vendure Roles (D53): one for all stores, one per selected store. Callers hold the
 * lock (D70), so a store opening concurrently either is read here or extends the binding created here.
 */
export class BindingProjector {
  constructor(private readonly ports: BindingProjectorPorts) {}

  /** The Vendure Roles a member with these assignments holds, creating any missing binding. */
  async bindingsFor(
    ctx: OperationContext,
    scope: TenantScope,
    assignments: readonly ProjectedAssignment[],
  ): Promise<number[]> {
    const { bindings, directory } = this.ports;
    const projection: Projection = {
      ctx,
      scope,
      stores: await directory.stores(ctx, scope.businessId),
      existing: [...(await bindings.allBindings(ctx, scope))],
    };
    const vendureRoleIds: number[] = [];
    for (const { role, storeAccess, storeIds } of assignments) {
      for (const bindingScope of storeAccess === 'all' ? [ALL_STORES_SCOPE] : storeIds) {
        vendureRoleIds.push(await this.ensureBinding(projection, role, bindingScope));
      }
    }
    return [...new Set(vendureRoleIds)];
  }

  /** Deletes each `selected` binding among `released` that no assignment holds any more (D53). */
  async releaseUnheld(ctx: OperationContext, scope: TenantScope, released: readonly MemberAssignment[]): Promise<void> {
    const { assignments, bindings, engine } = this.ports;
    const pairs = selectedPairs(released);
    if (pairs.length === 0) return;
    const roleIds = [...new Set(pairs.map(([roleId]) => roleId))];
    const held = selectedPairs(await assignments.ofRoles(ctx, scope, roleIds));
    const stillHeld = new Set(held.map(([roleId, storeId]) => `${roleId}:${storeId}`));
    const all = await bindings.allBindings(ctx, scope);
    for (const binding of all.filter((row) => row.scope !== ALL_STORES_SCOPE)) {
      const wasReleased = pairs.some(([roleId, store]) => roleId === binding.businessRoleId && store === binding.scope);
      if (wasReleased && !stillHeld.has(`${binding.businessRoleId}:${binding.scope}`)) {
        await bindings.delete(ctx, scope, binding.id);
        await engine.deleteRole(ctx, binding.vendureRoleId);
      }
    }
  }

  private async ensureBinding(projection: Projection, role: BusinessRole, scope: BindingScope): Promise<number> {
    const found = projection.existing.find((row) => row.businessRoleId === role.id && row.scope === scope);
    if (found !== undefined) return found.vendureRoleId;
    const { ctx, scope: tenant, stores, existing } = projection;
    const { engine, bindings, ids } = this.ports;
    const vendureRoleId = await engine.createRole(ctx, {
      code: vendureRoleCode(role.id, scope),
      permissions: [ENGINE_BASE_PERMISSION, ...this.enginePermissionsOf(role)],
      channelIds: this.channelsOf(scope, stores),
    });
    const binding: RoleBinding = { id: ids.next(), businessRoleId: role.id, scope, vendureRoleId };
    await bindings.insert(ctx, tenant, binding);
    existing.push(binding);
    return vendureRoleId;
  }

  /** Archived stores are included: tenancy's resolver filters them, and a restored store would then just work. */
  private channelsOf(scope: BindingScope, stores: readonly BusinessStore[]): readonly number[] {
    return stores.filter((store) => scope === ALL_STORES_SCOPE || store.id === scope).map((store) => store.channelId);
  }

  private enginePermissionsOf(role: BusinessRole): readonly string[] {
    // Owner also keeps every other assignable plugin permission (D59).
    return role.builtInKey === 'owner' ? this.ports.engine.ownerPermissions() : enginePermissionsFor(role.permissions);
  }
}
