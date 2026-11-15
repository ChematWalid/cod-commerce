import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { PackPricesService } from '../application/pack-prices.service';
import { PACK_RESOLVER_KEY } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import type { PackPriceResolverShape, PackUnitPrice, PriceLine } from '../domain/ports/pack-price-resolver-shape.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * The pack `UnitPriceResolver` of the pricing pipeline (D2204): live unit prices of pack variants, never the stored
 * price; a stale pack and a line of no pack of the scope are left out. Exported, **not registered**: P2.S4 registers
 * it with its pricing service (whichever of the two merges second wires the line).
 */
@Injectable()
export class PackUnitPriceResolver implements PackPriceResolverShape<RequestContext> {
  readonly key = PACK_RESOLVER_KEY;

  constructor(private readonly prices: PackPricesService) {}

  /** Unit prices by variant id for the pack lines among `lines`, in the scope's store. */
  resolve(
    ctx: RequestContext,
    scope: StoreScope,
    lines: readonly PriceLine[],
  ): Promise<ReadonlyMap<string, PackUnitPrice>> {
    return this.prices.resolve(asOperationContext(ctx), scope, lines);
  }
}
