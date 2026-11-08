import type { Snowflake } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The channel a new store needs. */
export interface ChannelRequest {
  readonly sellerId: number;
  readonly language: string;
}

/** A business's first administrator. `password` goes to the commerce engine only: never logged or stored by us. */
export interface AdministratorRequest {
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
  readonly roleId: number;
  readonly businessId: Snowflake;
}

/** The commerce engine's sellers, channels, roles and administrators. Ids are the engine's integers. */
export interface ChannelProvisionerPort {
  /** The languages the global settings offer. */
  availableLanguages(ctx: OperationContext): Promise<readonly string[]>;
  createSeller(ctx: OperationContext, name: string): Promise<number>;
  /** Creates the business's placeholder Owner role, on no channel yet (D6). */
  createOwnerRole(ctx: OperationContext, businessId: Snowflake): Promise<number>;
  /** @throws {UnsupportedStoreLanguageError} when the engine refuses the language. */
  createChannel(ctx: OperationContext, request: ChannelRequest): Promise<number>;
  assignRoleToChannel(ctx: OperationContext, roleId: number, channelId: number): Promise<void>;
  createAdministrator(ctx: OperationContext, request: AdministratorRequest): Promise<number>;
}
