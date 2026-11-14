import type { StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SoldOutSource, SoldOutSourceRegistrar } from '../domain/ports/sold-out-source.port';

/**
 * The sold-out source the use cases read (D2107): the default source (the manual flag) until another plugin, stock in
 * P6.S1, registers its own on bootstrap (precedent: the order-manager check registry, D2114). Registering instead of
 * overriding a provider keeps the catalog free of a dependency on the plugin that replaces it.
 */
export class SoldOutSourceRegistry implements SoldOutSource, SoldOutSourceRegistrar {
  private registered: SoldOutSource | undefined;

  constructor(private readonly fallback: SoldOutSource) {}

  register(source: SoldOutSource): void {
    if (this.registered !== undefined) throw new Error('A sold-out source is already registered');
    this.registered = source;
  }

  soldOutIds(
    ctx: OperationContext,
    scope: TenantScope,
    storeId: StoreId,
    productIds: readonly CoreId[],
  ): Promise<ReadonlySet<string>> {
    return this.current().soldOutIds(ctx, scope, storeId, productIds);
  }

  allSoldOutIds(ctx: OperationContext, scope: TenantScope, storeId: StoreId): Promise<readonly CoreId[]> {
    return this.current().allSoldOutIds(ctx, scope, storeId);
  }

  private current(): SoldOutSource {
    return this.registered ?? this.fallback;
  }
}
