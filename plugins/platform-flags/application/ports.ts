import type { FlagCachePort } from '../domain/ports/flag-cache.port';
import type { FlagStorePort } from '../domain/ports/flag-store.port';
import type { PlanOfBusinessPort } from '../domain/ports/plan-of-business.port';
import type { ScopeDirectoryPort } from '../domain/ports/scope-directory.port';
import type { FlagSubject } from '../domain/snapshot';

/** Time, so tests can move it. */
export interface FlagClock {
  now(): number;
}

/** Where the flag services say what needs a person's eye. */
export interface FlagLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** The subject of a request: its business and active store when the request has a tenant, nothing otherwise. */
export interface FlagSubjectPort {
  subjectOf(request: object): FlagSubject;
}

/** What {@link FeatureFlags} reads flags through. */
export interface FeatureFlagsPorts {
  readonly store: FlagStorePort;
  readonly cache: FlagCachePort;
  readonly plans: PlanOfBusinessPort;
  readonly subjects: FlagSubjectPort;
  readonly clock: FlagClock;
  readonly logger: FlagLogger;
}

/** What {@link FlagAdminService} changes flags through. */
export interface FlagAdminPorts {
  readonly store: FlagStorePort;
  readonly cache: FlagCachePort;
  readonly directory: ScopeDirectoryPort;
  readonly logger: FlagLogger;
}
