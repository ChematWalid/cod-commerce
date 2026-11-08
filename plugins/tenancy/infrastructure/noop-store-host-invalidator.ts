import { Injectable } from '@nestjs/common';
import type { StoreHostInvalidatorPort } from '../domain/ports/store-host-invalidator.port';

/** Nothing caches a store's hosts yet. Task 5 replaces this adapter. */
@Injectable()
export class NoopStoreHostInvalidator implements StoreHostInvalidatorPort {
  invalidate(): Promise<void> {
    return Promise.resolve();
  }
}
