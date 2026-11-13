import type { Snowflake, TenantScope } from '@cod/shared';
import type { CommissionConfig } from '../commission-config';
import type { OperationContext } from './operation-context';

/** Where commission configs are kept, confined to `scope.businessId`. */
export interface CommissionConfigRepositoryPort {
  /** Stores a new config; rejects a name key the business already uses. */
  insert(ctx: OperationContext, scope: TenantScope, config: CommissionConfig): Promise<void>;

  /** The config `id`, or `undefined`. */
  findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<CommissionConfig | undefined>;

  /** The config with that name key, or `undefined`. */
  findByNameKey(ctx: OperationContext, scope: TenantScope, nameKey: string): Promise<CommissionConfig | undefined>;

  /** Every config of the business, by name key. */
  list(ctx: OperationContext, scope: TenantScope): Promise<readonly CommissionConfig[]>;

  /** Replaces the stored fields of `config.id`; `false` when the business has no such config. */
  update(ctx: OperationContext, scope: TenantScope, config: CommissionConfig): Promise<boolean>;

  /** Deletes the config `id`; `false` when the business has no such config. */
  delete(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<boolean>;
}
