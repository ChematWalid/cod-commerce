import type { GeoSeed, GeoSeedCounts } from '../domain/geo-seed';
import type { GeoSeedStore } from '../domain/ports/geo-seed-store.port';

/** Where the seed service reports what it did. */
export interface GeoLogger {
  info(message: string): void;
}

/** What one {@link GeoSeedService.converge} run wrote. */
export type GeoSeedReport = GeoSeedCounts;

/**
 * Converges the global wilaya and commune tables on the seed (D3116): on every `migrate`, and on demand with
 * `pnpm seed:geo`. Idempotent: a second run leaves the same rows.
 */
export class GeoSeedService {
  constructor(
    private readonly store: GeoSeedStore,
    private readonly seed: GeoSeed,
    private readonly logger: GeoLogger,
  ) {}

  /** Upserts every wilaya and commune of the seed; rows that left the seed stay. */
  async converge(): Promise<GeoSeedReport> {
    const report = await this.store.upsert(this.seed);
    this.logger.info(`Geo seed: ${String(report.provinces)} wilayas and ${String(report.towns)} communes converged`);
    return report;
  }
}
