import type { HealthProbeResponse } from '@cod/shared';

/** The dependencies `/readyz` checks. */
export const PROBE_NAMES = ['postgres', 'redis', 'migrations'] as const;

/** One of the {@link PROBE_NAMES}. */
export type ProbeName = (typeof PROBE_NAMES)[number];

/** The HTTP paths of the probe endpoints, on the api port and on the worker health port. */
export const HEALTH_PATHS = { live: '/livez', ready: '/readyz' } as const;

/** How long each readiness probe may take before it counts as failed. */
export const PROBE_TIMEOUT_MS = { postgres: 500, redis: 200, migrations: 2000 } as const satisfies Record<
  ProbeName,
  number
>;

/** Above this event-loop lag the process is stuck and `/livez` fails, so the orchestrator restarts it. */
export const LIVENESS_MAX_EVENT_LOOP_LAG_MS = 1000;

/** The HTTP status that answers each probe status. */
export const HEALTH_HTTP_STATUS = { ready: 200, not_ready: 503 } as const satisfies Record<
  HealthProbeResponse['status'],
  number
>;

/** The HTTP status of a path the worker health server does not serve. */
export const HTTP_NOT_FOUND = 404;

/** The HTTP status of a probe endpoint that itself failed. */
export const HTTP_INTERNAL_ERROR = 500;

/** BullMQ loses jobs when Valkey evicts keys, so this is the only accepted `maxmemory-policy`. */
export const REQUIRED_REDIS_EVICTION_POLICY = 'noeviction';

/** How long the eviction-policy check may take; past it, Valkey counts as unreachable. */
export const REDIS_EVICTION_GUARD_TIMEOUT_MS = 2000;

/** While Valkey is unreachable, its client logs at most one warning per interval instead of one per retry. */
export const REDIS_ERROR_LOG_INTERVAL_MS = 30_000;

/** The logger context of everything this plugin logs. */
export const LOGGER_CONTEXT = 'PlatformHealthPlugin';
