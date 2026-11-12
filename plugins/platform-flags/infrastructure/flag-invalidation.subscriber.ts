import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { FeatureFlags } from '../application/feature-flags.service';
import { FLAG_SUBSCRIBER_CACHE } from './tokens';
import type { ValkeyFlagCache } from './valkey-flag-cache';

/**
 * Connects the Valkey notice to the process snapshot: a change announced by any process makes this one read the new
 * flags on the next question, and so does its own subscriber reconnecting. Closes both Valkey clients on shutdown.
 */
@Injectable()
export class FlagInvalidationSubscriber implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(FLAG_SUBSCRIBER_CACHE) private readonly cache: ValkeyFlagCache,
    @Inject(FeatureFlags) private readonly flags: FeatureFlags,
  ) {}

  onApplicationBootstrap(): void {
    this.cache.subscribe(() => {
      this.flags.forget();
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.cache.close();
  }
}
