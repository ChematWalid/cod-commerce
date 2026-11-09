import { type Snowflake, toSnowflake } from '@cod/shared';
import type { CreateStoreInput as CreateStoreCommand, SoldOutBehavior, StorePatch } from '../domain/store';
import type { BusinessPatch } from '../domain/ports/platform-store.port';

/** `createStore`'s input, whose `logoAssetId` the id codec has already decoded. */
export interface CreateStoreInputDto {
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
  readonly description?: string | null;
  readonly logoAssetId?: number | null;
}

/** `provisionBusiness`'s input. */
export interface ProvisionBusinessInputDto {
  readonly name: string;
  readonly owner: {
    readonly emailAddress: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly password: string;
  };
  readonly store: CreateStoreInputDto;
}

/** `updateBusiness`'s input. */
export interface UpdateBusinessInputDto {
  readonly name?: string | null;
  readonly logoAssetId?: number | null;
}

/** `updateStore`'s input. */
export interface UpdateStoreInputDto {
  readonly name?: string | null;
  readonly description?: string | null;
  readonly logoAssetId?: number | null;
  readonly language?: string | null;
  readonly defaultDeliveryFeeGroupId?: string | null;
  readonly defaultCarrierId?: string | null;
  readonly showAddressField?: boolean | null;
  readonly soldOutBehavior?: SoldOutBehavior | null;
}

/** Drops keys the client left out, and `null` on columns that cannot be empty. */
function withoutNullish<T extends object>(values: T): { [K in keyof T]?: NonNullable<T[K]> } {
  const kept = Object.entries(values).filter(([, value]) => value !== undefined && value !== null);
  return Object.fromEntries(kept) as { [K in keyof T]?: NonNullable<T[K]> };
}

/** Drops keys the client left out; `null` stays, because on these columns it clears the value. */
function withoutUndefined<T extends object>(values: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const kept = Object.entries(values).filter(([, value]) => value !== undefined);
  return Object.fromEntries(kept) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

function optionalSnowflake(value: string | null | undefined): Snowflake | null | undefined {
  return value === undefined || value === null ? value : toSnowflake(value);
}

/** @throws {InvalidSnowflakeError} when a reference is not a snowflake. */
export function toStorePatch(input: UpdateStoreInputDto): StorePatch {
  const { name, description, language, showAddressField, soldOutBehavior, logoAssetId } = input;
  return {
    ...withoutNullish({ name, description, language, showAddressField, soldOutBehavior }),
    ...withoutUndefined({
      logoAssetId,
      defaultDeliveryFeeGroupId: optionalSnowflake(input.defaultDeliveryFeeGroupId),
      defaultCarrierId: optionalSnowflake(input.defaultCarrierId),
    }),
  };
}

/** The patch `updateBusiness` asks for. */
export function toBusinessPatch({ name, logoAssetId }: UpdateBusinessInputDto): BusinessPatch {
  return { ...withoutNullish({ name }), ...withoutUndefined({ logoAssetId }) };
}

/** The command `createStore` and `provisionBusiness` ask for. */
export function toCreateStoreCommand(input: CreateStoreInputDto): CreateStoreCommand {
  const { name, subdomain, language, description, logoAssetId } = input;
  return { name, subdomain, language, ...withoutNullish({ description, logoAssetId }) };
}
