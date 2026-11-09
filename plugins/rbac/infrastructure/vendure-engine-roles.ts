import { asOperationContext as asTenancyContext, ownerRolePermissions } from '@cod/plugin-tenancy';
import { SuperadminContextFactory } from '@cod/plugin-tenancy/provisioning';
import { Injectable } from '@nestjs/common';
import {
  AdministratorService,
  ConfigService,
  EntityNotFoundError,
  type Permission,
  type RequestContext,
  RoleService,
} from '@vendure/core';
import type { EngineRoleRequest, EngineRolesPort, EngineRoleState } from '../domain/ports/engine-roles.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-context';

/** Our permission names extend the enum at runtime only, so the compiler cannot know them. */
const asPermissions = (names: readonly string[]): Permission[] => names.map((name) => name as unknown as Permission);

/** {@link EngineRolesPort} on Vendure's services, so its entity events fire (D55). */
@Injectable()
export class VendureEngineRoles implements EngineRolesPort {
  private readonly sharedActors = new WeakMap<OperationContext, RequestContext>();

  constructor(
    private readonly superadmins: SuperadminContextFactory,
    private readonly roles: RoleService,
    private readonly administrators: AdministratorService,
    private readonly config: ConfigService,
  ) {}

  async createRole(ctx: OperationContext, { code, permissions, channelIds }: EngineRoleRequest): Promise<number> {
    const role = await this.roles.create(await this.superadmin(ctx), {
      code,
      description: code,
      permissions: asPermissions(permissions),
      // Always explicit: without `channelIds` Vendure would put the role on the caller's channel.
      channelIds: [...channelIds],
    });
    return role.id as number;
  }

  async updatePermissions(ctx: OperationContext, roleId: number, permissions: readonly string[]): Promise<void> {
    await this.roles.update(await this.superadmin(ctx), { id: roleId, permissions: asPermissions(permissions) });
  }

  async addChannel(ctx: OperationContext, roleId: number, channelId: number): Promise<void> {
    await this.roles.assignRoleToChannel(await this.superadmin(ctx), roleId, channelId);
  }

  async deleteRole(ctx: OperationContext, roleId: number): Promise<void> {
    await this.roles.delete(await this.superadmin(ctx), roleId);
  }

  async setAdministratorRoles(
    ctx: OperationContext,
    administratorId: number,
    roleIds: readonly number[],
  ): Promise<void> {
    await this.administrators.update(await this.superadmin(ctx), { id: administratorId, roleIds: [...roleIds] });
  }

  async permissionsOf(ctx: OperationContext, roleId: number): Promise<readonly string[]> {
    const role = await this.roles.findOne(await this.superadmin(ctx), roleId);
    if (role === undefined) throw new EntityNotFoundError('Role', roleId);
    return role.permissions;
  }

  async describeRole(ctx: OperationContext, roleId: number): Promise<EngineRoleState> {
    const role = await this.roles.findOne(await this.superadmin(ctx), roleId);
    if (role === undefined) throw new EntityNotFoundError('Role', roleId);
    return { permissions: role.permissions, channelIds: role.channels.map((channel) => channel.id as number) };
  }

  ownerPermissions(): readonly string[] {
    return ownerRolePermissions(this.config.authOptions.customPermissions);
  }

  async reuseActorFor(ctx: OperationContext): Promise<void> {
    this.sharedActors.set(ctx, await this.newSuperadmin(ctx));
  }

  private superadmin(ctx: OperationContext): Promise<RequestContext> {
    const shared = this.sharedActors.get(ctx);
    return shared === undefined ? this.newSuperadmin(ctx) : Promise.resolve(shared);
  }

  /** Built per call by default, because Vendure caches a user's channels per context and channels are added as stores open. */
  private newSuperadmin(ctx: OperationContext): Promise<RequestContext> {
    return this.superadmins.create(asTenancyContext(toRequestContext(ctx)));
  }
}
