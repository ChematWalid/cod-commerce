import {
  TOWN_AVAILABILITY_REGISTRAR,
  type TownAvailability,
  type TownAvailabilityRegistrar,
  type TownAvailabilitySource,
} from '@cod/plugin-geo';
import type { StoreId, WilayaCode } from '@cod/shared';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { RequestContextService } from '@vendure/core';
import { TownAvailabilityService } from '../application/town-availability.service';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * The store's fee table on geo's `TOWN_AVAILABILITY_REGISTRAR` (D3127), registered on bootstrap (the plugin comes
 * after `GeoPlugin`). Geo calls it from the signed storefront route, without a session: it opens a platform context,
 * and the service confines every read to the store's own business and store.
 */
@Injectable()
export class DeliveryTownAvailabilitySource implements TownAvailabilitySource, OnApplicationBootstrap {
  constructor(
    private readonly availability: TownAvailabilityService,
    private readonly contexts: RequestContextService,
    @Inject(TOWN_AVAILABILITY_REGISTRAR) private readonly registrar: TownAvailabilityRegistrar,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  async availabilityFor(storeId: StoreId, provinceCode: WilayaCode): Promise<TownAvailability> {
    const ctx = asOperationContext(await this.contexts.create({ apiType: 'admin' }));
    return this.availability.modesIn(ctx, storeId, provinceCode);
  }
}
