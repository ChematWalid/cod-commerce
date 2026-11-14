import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { type CoreId, toCoreId } from '../domain/core-id';
import { ConcurrentUpdateError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductSettingsRepositoryPort } from '../domain/ports/product-settings-repository.port';
import type { ProductSettings } from '../domain/product-settings';
import type { StoreScope } from '../domain/store-scope';
import { ProductSettingsEntity } from './product-settings.entity';
import { requestScope } from './request-scope';
import { inStore } from './store-where';
import { onUniqueViolation } from './unique-violation';

function toSettings(row: ProductSettingsEntity): ProductSettings {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    storeId: toStoreId(row.storeId ?? ''),
    productId: toCoreId(row.productId),
    nameInDelivery: row.nameInDelivery,
    isFragile: row.isFragile,
    allowParcelOpening: row.allowParcelOpening,
    allowOutOfStockOrders: row.allowOutOfStockOrders,
    soldOut: row.soldOut,
    quantityRules: { enabled: row.quantityRulesEnabled, min: row.quantityMin, step: row.quantityStep },
    orderManagerIds: row.orderManagerIds.map(toSnowflake),
    customAttributes: row.customAttributes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The columns an upsert writes over an existing row: everything but the id, keys and creation date. */
function changedFields(settings: ProductSettings) {
  const { quantityRules, orderManagerIds, customAttributes } = settings;
  return {
    nameInDelivery: settings.nameInDelivery,
    isFragile: settings.isFragile,
    allowParcelOpening: settings.allowParcelOpening,
    allowOutOfStockOrders: settings.allowOutOfStockOrders,
    soldOut: settings.soldOut,
    quantityRulesEnabled: quantityRules.enabled,
    quantityMin: quantityRules.min,
    quantityStep: quantityRules.step,
    orderManagerIds: [...orderManagerIds],
    customAttributes: customAttributes.map((attribute) => ({ ...attribute })),
    updatedAt: settings.updatedAt,
  };
}

/** The Postgres adapter of {@link ProductSettingsRepositoryPort}: `catalog_product_settings` via `TenantRepository`. */
@Injectable()
export class TypeOrmProductSettingsRepository implements ProductSettingsRepositoryPort {
  private readonly rows: TenantRepository<ProductSettingsEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(ProductSettingsEntity);
  }

  async findByProduct(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
  ): Promise<ProductSettings | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...inStore(scope), productId });
    return row === null ? undefined : toSettings(row);
  }

  /**
   * Updates, then inserts when no row changed. The `(businessId, storeId, productId)` index refuses a parallel first
   * insert; that refusal becomes {@link ConcurrentUpdateError}, since a retry inside the aborted transaction cannot work.
   */
  async upsert(ctx: OperationContext, scope: StoreScope, settings: ProductSettings): Promise<void> {
    const tenant = requestScope(ctx, scope);
    const where = { ...inStore(scope), productId: settings.productId };
    const changed = await this.rows.update(tenant, where, changedFields(settings));
    if (changed > 0) return;
    const { id, productId, createdAt } = settings;
    const row = { id, productId, createdAt, ...inStore(scope), ...changedFields(settings) };
    await onUniqueViolation(this.rows.insert(tenant, row), () => new ConcurrentUpdateError());
  }

  async delete(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<boolean> {
    const deleted = await this.rows.delete(requestScope(ctx, scope), { ...inStore(scope), productId });
    return deleted > 0;
  }
}
