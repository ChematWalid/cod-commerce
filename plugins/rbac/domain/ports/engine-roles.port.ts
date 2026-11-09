import type { OperationContext } from './operation-context';

/** A Vendure Role to create. */
export interface EngineRoleRequest {
  readonly code: string;
  readonly permissions: readonly string[];
  readonly channelIds: readonly number[];
}

/** What a Vendure Role holds now. */
export interface EngineRoleState {
  readonly permissions: readonly string[];
  readonly channelIds: readonly number[];
}

/**
 * Vendure's roles, written as the superadmin: every use case has already applied its own rules (D60), and the caller
 * may be anonymous. Ids are Vendure's integers (D68). Writes join the transaction `ctx` carries.
 */
export interface EngineRolesPort {
  createRole(ctx: OperationContext, request: EngineRoleRequest): Promise<number>;
  updatePermissions(ctx: OperationContext, roleId: number, permissions: readonly string[]): Promise<void>;
  addChannel(ctx: OperationContext, roleId: number, channelId: number): Promise<void>;
  deleteRole(ctx: OperationContext, roleId: number): Promise<void>;
  setAdministratorRoles(ctx: OperationContext, administratorId: number, roleIds: readonly number[]): Promise<void>;
  permissionsOf(ctx: OperationContext, roleId: number): Promise<readonly string[]>;
  describeRole(ctx: OperationContext, roleId: number): Promise<EngineRoleState>;
  /** What an Owner's Vendure Role holds: every assignable plugin permission except the platform's own (D59). */
  ownerPermissions(): readonly string[];
  /**
   * Makes later calls with this `ctx` share one superadmin instead of loading one each. Only for work that opens no
   * channel while `ctx` lives: the shared superadmin does not see a channel created after it was loaded.
   */
  reuseActorFor(ctx: OperationContext): Promise<void>;
}
