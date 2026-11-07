/** The outcome of one health check. `error` is set only when the check failed. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

/**
 * The body of every health probe endpoint (`/readyz`, `/livez`) across the server and the storefront:
 * an overall status and one result per named check.
 */
export interface HealthProbeResponse<TCheck extends string = string> {
  readonly status: 'ready' | 'not_ready';
  readonly checks: Readonly<Record<TCheck, HealthCheckResult>>;
}
