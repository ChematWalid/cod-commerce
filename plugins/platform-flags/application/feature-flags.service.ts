import { FLAG_SEEDS, type FlagKey } from '@cod/shared';
import { FLAG_SNAPSHOT_TTL_MS } from '../domain/constants';
import { evaluateFlag } from '../domain/evaluate';
import type { FlagSnapshot, FlagState, FlagSubject } from '../domain/snapshot';
import type { FeatureFlagsPorts } from './ports';

/** After a failed refresh the stale snapshot is served and the refresh is tried again this much later. */
const REFRESH_RETRY_MS = 5000;

const EPOCH = new Date(0).toISOString();

interface Cached {
  readonly snapshot: FlagSnapshot;
  /** Epoch ms after which the snapshot is stale. */
  readonly staleAtMs: number;
}

/** A seeded flag the database does not hold yet (migrate has not run) reads as its seed, never as off. */
function withSeedDefaults(snapshot: FlagSnapshot): FlagSnapshot {
  const missing = FLAG_SEEDS.filter((seed) => snapshot.flags[seed.key] === undefined);
  if (missing.length === 0) return snapshot;
  const added: Record<string, FlagState> = {};
  for (const seed of missing) {
    added[seed.key] = {
      description: seed.description,
      defaultEnabled: seed.defaultEnabled,
      rolloutPercent: seed.rolloutPercent,
      updatedAt: EPOCH,
      overrides: [],
    };
  }
  return { flags: { ...snapshot.flags, ...added } };
}

/**
 * Answers "is this flag on for this business" (D116). The snapshot of every flag lives 30 s in the process, then comes
 * from Valkey, then from the database. A Valkey fault falls through to the database; a database fault with an older
 * snapshot in hand serves that snapshot and retries a few seconds later, because a kill switch must not turn into an
 * error page. Once a change commits, {@link forget} (this process) and the pub/sub notice (the others) drop the snapshot.
 */
export class FeatureFlags {
  private cached: Cached | undefined;
  private loading: Promise<FlagSnapshot> | undefined;
  /** Bumped by {@link forget}, so a load that started before a change does not outlive it. */
  private generation = 0;

  constructor(private readonly ports: FeatureFlagsPorts) {}

  /** The flag for the request's business and active store; for a request without a tenant, as for the platform. */
  isEnabled(request: object, key: FlagKey): Promise<boolean> {
    return this.isEnabledFor(this.ports.subjects.subjectOf(request), key);
  }

  /** The flag for `subject`; a plan override applies when the business has a plan. */
  async isEnabledFor(subject: FlagSubject, key: FlagKey): Promise<boolean> {
    const snapshot = await this.snapshot();
    const planKey = await this.planKeyOf(snapshot, subject, key);
    return evaluateFlag(snapshot, key, subject, planKey);
  }

  /** Drops the process snapshot: the next question reads Valkey or the database again. */
  forget(): void {
    this.generation += 1;
    this.cached = undefined;
    // A refresh already reading may hold the pre-change data: later questions start their own.
    this.loading = undefined;
  }

  private async planKeyOf(snapshot: FlagSnapshot, subject: FlagSubject, key: FlagKey): Promise<string | undefined> {
    const hasPlanOverride = snapshot.flags[key]?.overrides.some((override) => override.scope === 'plan') === true;
    if (!hasPlanOverride || subject.businessId === undefined) return undefined;
    return this.ports.plans.planKeyOf(subject.businessId);
  }

  private snapshot(): Promise<FlagSnapshot> {
    const { cached } = this;
    if (cached !== undefined && this.ports.clock.now() < cached.staleAtMs) return Promise.resolve(cached.snapshot);
    if (this.loading !== undefined) return this.loading;
    const loading: Promise<FlagSnapshot> = this.refresh().finally(() => {
      if (this.loading === loading) this.loading = undefined;
    });
    this.loading = loading;
    return loading;
  }

  private async refresh(): Promise<FlagSnapshot> {
    const generation = this.generation;
    const stale = this.cached;
    try {
      const snapshot = withSeedDefaults(await this.load(generation));
      if (generation === this.generation) {
        this.cached = { snapshot, staleAtMs: this.ports.clock.now() + FLAG_SNAPSHOT_TTL_MS };
      }
      return snapshot;
    } catch (error: unknown) {
      if (stale === undefined) throw error;
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.ports.logger.error(`Feature flags could not be refreshed, serving the previous snapshot: ${reason}`);
      // A change since the refresh began makes the old snapshot wrong: serve it this once, but do not keep it.
      if (generation === this.generation) {
        this.cached = { snapshot: stale.snapshot, staleAtMs: this.ports.clock.now() + REFRESH_RETRY_MS };
      }
      return stale.snapshot;
    }
  }

  private async load(generation: number): Promise<FlagSnapshot> {
    const shared = await this.ports.cache.read();
    if (shared !== undefined) return shared;
    const snapshot = await this.ports.store.loadSnapshot();
    // A change since the read began makes this snapshot stale: it must not reach Valkey after the invalidation.
    // A failed write is the cache's own business: it logs, and the next process asks the database again.
    if (generation === this.generation) await this.ports.cache.write(snapshot);
    return snapshot;
  }
}
