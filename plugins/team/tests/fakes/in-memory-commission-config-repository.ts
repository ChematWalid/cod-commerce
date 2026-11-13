import type { Snowflake, TenantScope } from '@cod/shared';
import type { CommissionConfig } from '../../domain/commission-config';
import type { CommissionConfigRepositoryPort } from '../../domain/ports/commission-config-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';

/** Commission configs in memory, one name key per business as the table has; it passes the contract. */
export class InMemoryCommissionConfigRepository implements CommissionConfigRepositoryPort {
  readonly rows: CommissionConfig[] = [];

  private indexOf(scope: TenantScope, id: Snowflake): number {
    return this.rows.findIndex((row) => row.businessId === scope.businessId && row.id === id);
  }

  insert(_ctx: OperationContext, scope: TenantScope, config: CommissionConfig): Promise<void> {
    const taken = this.rows.some((row) => row.businessId === scope.businessId && row.nameKey === config.nameKey);
    if (taken) return Promise.reject(new Error('duplicate key value violates unique constraint "commission_name"'));
    this.rows.push({ ...config, businessId: scope.businessId });
    return Promise.resolve();
  }

  findById(_ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<CommissionConfig | undefined> {
    return Promise.resolve(this.rows[this.indexOf(scope, id)]);
  }

  findByNameKey(_ctx: OperationContext, scope: TenantScope, nameKey: string): Promise<CommissionConfig | undefined> {
    return Promise.resolve(this.rows.find((row) => row.businessId === scope.businessId && row.nameKey === nameKey));
  }

  list(_ctx: OperationContext, scope: TenantScope): Promise<readonly CommissionConfig[]> {
    const own = this.rows.filter((row) => row.businessId === scope.businessId);
    return Promise.resolve(
      [...own].sort((left, right) => left.nameKey.localeCompare(right.nameKey) || (left.id < right.id ? -1 : 1)),
    );
  }

  update(_ctx: OperationContext, scope: TenantScope, config: CommissionConfig): Promise<boolean> {
    const index = this.indexOf(scope, config.id);
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1, { ...config, businessId: scope.businessId });
    return Promise.resolve(true);
  }

  delete(_ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<boolean> {
    const index = this.indexOf(scope, id);
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1);
    return Promise.resolve(true);
  }
}
