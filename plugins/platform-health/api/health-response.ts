import type { HealthProbeResponse } from '@cod/shared';
import { HEALTH_HTTP_STATUS } from '../domain/constants';

/** A probe report as an HTTP response. */
export interface HealthResponse<TCheck extends string> {
  readonly statusCode: (typeof HEALTH_HTTP_STATUS)[keyof typeof HEALTH_HTTP_STATUS];
  readonly body: HealthProbeResponse<TCheck>;
}

/** Maps a readiness or liveness report to its HTTP response: 200 when ready, 503 otherwise. */
export function toHealthResponse<TCheck extends string>(report: HealthProbeResponse<TCheck>): HealthResponse<TCheck> {
  return { statusCode: HEALTH_HTTP_STATUS[report.status], body: report };
}
