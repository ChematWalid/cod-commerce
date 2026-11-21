import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CollectionService } from '@vendure/core';

/**
 * Turns off Vendure's stock collection-filter job on product updates (D2301). It is a global switch on a core service:
 * left on, every product save of any business scans every collection of the platform, and no collection of ours has a
 * filter (membership lives in `collections_member`, D2300). A plugin that needs stock filters re-enables it.
 */
@Injectable()
export class StockFiltersOff implements OnApplicationBootstrap {
  constructor(private readonly collections: CollectionService) {}

  onApplicationBootstrap(): void {
    this.collections.setApplyAllFiltersOnProductUpdates(false);
  }
}
