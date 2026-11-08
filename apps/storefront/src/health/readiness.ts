import type { HealthCheckResult, HealthProbeResponse } from '@cod/shared';

/** The storefront's `/readyz` body: one check, `redis`. */
export type StorefrontReadiness = HealthProbeResponse<'redis'>;

/**
 * The readiness of the storefront. It stays `ready` while Valkey is down, because the storefront then serves
 * uncached pages (plan deviation 15): taking it out of the load balancer would turn a cache outage into a
 * site outage. The check still reports the failure.
 */
export function toStorefrontReadiness(redis: HealthCheckResult): StorefrontReadiness {
  return { status: 'ready', checks: { redis } };
}
