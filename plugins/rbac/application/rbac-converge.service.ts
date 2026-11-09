import { type BuiltInRoleDefinition, type BuiltInRoleKey, type Snowflake, type TenantScope } from '@cod/shared';
import { type BusinessRole, newBuiltInRole, type RoleBinding } from '../domain/business-role';
import { ALL_STORES_SCOPE, CONVERGE_PAGE_SIZE, ENGINE_BASE_PERMISSION } from '../domain/constants';
import { enginePermissionsFor } from '../domain/engine-grants';
import { BusinessOwnerLinkMissingError, type ConvergeFailure, RbacConvergeFailedError } from '../domain/errors';
import type { BusinessDirectoryPort, ConvergeTarget } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** What converging reads and writes through. */
export interface RbacConvergePorts {
  readonly lock: RbacLockPort;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'insert' | 'findBuiltIn' | 'updatePermissions'>;
  readonly bindings: Pick<RoleBindingRepositoryPort, 'insert' | 'allBindings'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'insert' | 'isAssigned' | 'holdersOf'>;
  readonly engine: Pick<
    EngineRolesPort,
    'describeRole' | 'updatePermissions' | 'addChannel' | 'ownerPermissions' | 'reuseActorFor'
  >;
  readonly directory: Pick<BusinessDirectoryPort, 'page' | 'storeChannelIds'>;
  readonly transaction: TransactionPort;
  readonly flusher: SessionFlusherPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
  readonly templates: readonly BuiltInRoleDefinition[];
}

/** The outcome of one converge run; `changed` counts the businesses that had a difference. */
export interface ConvergeReport {
  readonly businesses: number;
  readonly changed: number;
}

/** One business inside its transaction: the business roles it changed so far. */
interface ConvergeRun {
  readonly ctx: OperationContext;
  readonly scope: TenantScope;
  readonly now: Date;
  readonly changed: Set<Snowflake>;
}

type BuiltIns = ReadonlyMap<BuiltInRoleKey, BusinessRole>;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const sameMembers = (left: readonly string[], right: readonly string[]): boolean => {
  const members = new Set(left);
  return members.size === new Set(right).size && right.every((name) => members.has(name));
};

/** Brings every business to the shipped built-in roles (D57). Reads first and writes only on a difference. */
export class RbacConvergeService {
  constructor(private readonly ports: RbacConvergePorts) {}

  /** One transaction per business: a failure undoes that business only, and is thrown once all have been tried. */
  async convergeAll(ctx: OperationContext): Promise<ConvergeReport> {
    let businesses = 0;
    let changed = 0;
    const failures: ConvergeFailure[] = [];
    let afterId: Snowflake | undefined;
    for (;;) {
      const page = await this.ports.directory.page(ctx, afterId, CONVERGE_PAGE_SIZE);
      businesses += page.length;
      changed += await this.convergePage(ctx, page, failures);
      const last = page.at(-1);
      if (page.length < CONVERGE_PAGE_SIZE || last === undefined) break;
      afterId = last.id as string as Snowflake;
    }
    if (failures.length > 0) throw new RbacConvergeFailedError(businesses, changed, failures);
    return { businesses, changed };
  }

  private async convergePage(
    ctx: OperationContext,
    page: readonly ConvergeTarget[],
    failures: ConvergeFailure[],
  ): Promise<number> {
    let changed = 0;
    for (const business of page) {
      try {
        if (await this.convergeBusiness(ctx, business)) changed += 1;
      } catch (error: unknown) {
        failures.push({ businessId: business.id, reason: reasonOf(error) });
      }
    }
    return changed;
  }

  /** Converges one business and, after its commit, flushes the holders of what changed. Answers whether anything did. */
  async convergeBusiness(ctx: OperationContext, business: ConvergeTarget): Promise<boolean> {
    const { transaction, flusher } = this.ports;
    const { changed, holders } = await transaction.run(ctx, { businessId: business.id }, (transactional) =>
      this.convergeInTransaction(transactional, business),
    );
    await flusher.flushAdministrators(holders);
    return changed;
  }

  private async convergeInTransaction(
    ctx: OperationContext,
    business: ConvergeTarget,
  ): Promise<{ changed: boolean; holders: readonly number[] }> {
    const { lock, clock, bindings, assignments, engine } = this.ports;
    await lock.acquire(ctx, business.id);
    // Converging opens no channel, and a no-op deploy would otherwise reload the superadmin per engine read.
    await engine.reuseActorFor(ctx);
    const run: ConvergeRun = { ctx, scope: { businessId: business.id }, now: clock.now(), changed: new Set() };
    const builtIns = await this.convergeRows(run);
    await this.adoptOwner(run, business, builtIns);
    const allBindings = await bindings.allBindings(ctx, run.scope);
    await this.convergeEnginePermissions(run, allBindings, builtIns);
    await this.extendAllStoresBindings(run, allBindings);
    if (run.changed.size === 0) return { changed: false, holders: [] };
    return { changed: true, holders: await assignments.holdersOf(ctx, run.scope, [...run.changed]) };
  }

  private async convergeRows(run: ConvergeRun): Promise<BuiltIns> {
    const builtIns = new Map<BuiltInRoleKey, BusinessRole>();
    for (const template of this.ports.templates) {
      builtIns.set(template.key, await this.convergeRow(run, template));
    }
    return builtIns;
  }

  private async convergeRow(run: ConvergeRun, template: BuiltInRoleDefinition): Promise<BusinessRole> {
    const { roles, ids } = this.ports;
    const existing = await roles.findBuiltIn(run.ctx, run.scope, template.key);
    if (existing === undefined) {
      const created = newBuiltInRole(template, ids.next(), run.now);
      await roles.insert(run.ctx, run.scope, created);
      run.changed.add(created.id);
      return created;
    }
    if (!sameMembers(existing.permissions, template.permissions)) {
      await roles.updatePermissions(run.ctx, run.scope, existing.id, {
        permissions: template.permissions,
        updatedAt: run.now,
      });
      run.changed.add(existing.id);
    }
    return existing;
  }

  /** Same Vendure Role id as before, so the owner's sessions and user row stay valid throughout. */
  private async adoptOwner(run: ConvergeRun, business: ConvergeTarget, builtIns: BuiltIns): Promise<void> {
    const { bindings, assignments, ids } = this.ports;
    const { ownerRoleId, ownerAdministratorId } = business;
    const owner = builtIns.get('owner');
    if (owner === undefined) throw new Error('The built-in templates have no owner role');
    if (ownerRoleId === null || ownerAdministratorId === null) throw new BusinessOwnerLinkMissingError(business.id);
    const current = await bindings.allBindings(run.ctx, run.scope);
    if (!current.some((binding) => binding.businessRoleId === owner.id && binding.scope === ALL_STORES_SCOPE)) {
      const binding = { id: ids.next(), businessRoleId: owner.id, scope: ALL_STORES_SCOPE, vendureRoleId: ownerRoleId };
      await bindings.insert(run.ctx, run.scope, binding);
      run.changed.add(owner.id);
    }
    if (!(await assignments.isAssigned(run.ctx, run.scope, ownerAdministratorId, owner.id))) {
      await assignments.insert(run.ctx, run.scope, {
        id: ids.next(),
        administratorId: ownerAdministratorId,
        businessRoleId: owner.id,
        storeAccess: ALL_STORES_SCOPE,
        storeIds: [],
        createdAt: run.now,
      });
      run.changed.add(owner.id);
    }
  }

  /** Every binding of a built-in, store-scoped ones too: each is a Vendure Role holding the template. */
  private async convergeEnginePermissions(
    run: ConvergeRun,
    allBindings: readonly RoleBinding[],
    builtIns: BuiltIns,
  ): Promise<void> {
    const { engine } = this.ports;
    for (const template of this.ports.templates) {
      const role = builtIns.get(template.key);
      const desired = [ENGINE_BASE_PERMISSION, ...this.enginePermissionsOf(template)];
      for (const binding of allBindings.filter(({ businessRoleId }) => businessRoleId === role?.id)) {
        const { permissions } = await engine.describeRole(run.ctx, binding.vendureRoleId);
        if (!sameMembers(permissions, desired)) {
          await engine.updatePermissions(run.ctx, binding.vendureRoleId, desired);
          run.changed.add(binding.businessRoleId);
        }
      }
    }
  }

  private enginePermissionsOf(template: BuiltInRoleDefinition): readonly string[] {
    // Owner also keeps every other assignable plugin permission (D59).
    return template.key === 'owner' ? this.ports.engine.ownerPermissions() : enginePermissionsFor(template.permissions);
  }

  /** Repairs a store opened while a hook was absent. */
  private async extendAllStoresBindings(run: ConvergeRun, allBindings: readonly RoleBinding[]): Promise<void> {
    const { engine, directory } = this.ports;
    const channelIds = await directory.storeChannelIds(run.ctx, run.scope.businessId);
    for (const binding of allBindings.filter(({ scope }) => scope === ALL_STORES_SCOPE)) {
      const held = new Set((await engine.describeRole(run.ctx, binding.vendureRoleId)).channelIds);
      for (const channelId of channelIds.filter((id) => !held.has(id))) {
        await engine.addChannel(run.ctx, binding.vendureRoleId, channelId);
        run.changed.add(binding.businessRoleId);
      }
    }
  }
}
