import { FLAG_SEEDS } from '@cod/shared';
import type { FlagStorePort } from '../domain/ports/flag-store.port';
import type { FlagLogger } from './ports';

/** What one {@link FlagSeedService.converge} run did. */
export interface FlagSeedReport {
  readonly inserted: number;
}

/** Inserts the flags that do not exist yet (D116). A flag staff already changed is never touched. */
export class FlagSeedService {
  constructor(
    private readonly store: FlagStorePort,
    private readonly logger: FlagLogger,
  ) {}

  async converge(): Promise<FlagSeedReport> {
    const inserted = await this.store.insertMissing(FLAG_SEEDS);
    this.logger.info(
      `Feature flags: ${String(inserted)} seeded, ${String(FLAG_SEEDS.length - inserted)} already there`,
    );
    return { inserted };
  }
}
