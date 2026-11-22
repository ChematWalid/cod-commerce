import type { Snowflake, WilayaCode } from '@cod/shared';
import type {
  CommuneRateRow,
  FeeGroupHeader,
  FeeGroupListQuery,
  FeeGroupPage,
  FeeGroupRecord,
  FeeGroupSettings,
  NewFeeGroup,
  WilayaRateRow,
} from '../fee-group';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** The commune rows one merge writes: rows to insert or replace, and communes whose row goes. */
export interface CommuneRowsChange {
  readonly upserts: readonly CommuneRateRow[];
  readonly removals: readonly number[];
}

/**
 * The fee groups of one store and their wilaya and commune rows. Every call is confined to `(businessId, storeId)`:
 * a group of another business or another store of the same business is never read or written (ADR 0002). Every call
 * joins the transaction `ctx` carries.
 */
export interface FeeGroupRepositoryPort {
  list(ctx: OperationContext, scope: StoreScope, query: FeeGroupListQuery): Promise<FeeGroupPage>;
  find(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupRecord | undefined>;
  /** The group's own row, locked `FOR UPDATE` until the transaction ends. */
  lock(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupHeader | undefined>;
  /** The id of the store's seeded "Platform default prices" group, if it has one. */
  platformDefaultId(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | undefined>;
  insert(ctx: OperationContext, scope: StoreScope, group: NewFeeGroup): Promise<Snowflake>;
  /** Replaces the group's settings and its wilaya rows; the commune rows stay. */
  update(
    ctx: OperationContext,
    scope: StoreScope,
    id: Snowflake,
    change: { readonly settings: FeeGroupSettings; readonly rates: readonly WilayaRateRow[] },
  ): Promise<void>;
  /** Deletes the group; its wilaya and commune rows go with it. */
  delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<void>;
  communeRows(
    ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    provinceCode: WilayaCode,
  ): Promise<readonly CommuneRateRow[]>;
  writeCommuneRows(
    ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    change: CommuneRowsChange,
  ): Promise<void>;
}
