import {
  type ResolverContext,
  UNIT_PRICE_RESOLVER_REGISTRAR,
  type UnitPriceResolver,
  type UnitPriceResolverRegistrar,
} from '@cod/plugin-offers';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PackPricesService } from '../application/pack-prices.service';
import { PACK_RESOLVER_KEY } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import type { PackUnitPrice, PriceLine } from '../domain/ports/pack-price-resolver-shape.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * The pack `UnitPriceResolver` of the offers' pricing pipeline (D2204, D2276): live unit prices of pack variants,
 * never the stored price; a stale pack and a line of no pack of the scope are left out. It registers itself with the
 * offers' `UNIT_PRICE_RESOLVER_REGISTRAR` on bootstrap; the offers' variant gate runs before it and keeps the line's
 * variant and product (D2423).
 */
@Injectable()
export class PackUnitPriceResolver implements UnitPriceResolver, OnApplicationBootstrap {
  readonly key = PACK_RESOLVER_KEY;

  constructor(
    private readonly prices: PackPricesService,
    @Inject(UNIT_PRICE_RESOLVER_REGISTRAR) private readonly registrar: UnitPriceResolverRegistrar,
  ) {}

  /** Registers the resolver with the offers once their registry exists (the plugin comes after `OffersPlugin`). */
  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  /** Unit prices by variant id for the pack lines among `lines`, in the scope's store. */
  resolve(
    ctx: ResolverContext,
    scope: StoreScope,
    lines: readonly PriceLine[],
  ): Promise<ReadonlyMap<string, PackUnitPrice>> {
    return this.prices.resolve(asOperationContext(ctx), scope, lines);
  }
}
