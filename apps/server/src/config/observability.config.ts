import { PlatformMetricsPlugin } from '@cod/plugin-platform-metrics';
import type { ErrorHandlerStrategy, VendureConfig } from '@vendure/core';
import { TelemetryPlugin } from '@vendure/telemetry-plugin';
import type { AppEnv, ServerRole } from './env';
import { VENDURE_LOG_LEVELS } from './log-levels';
import { SentryErrorHandlerStrategy } from './observability/sentry-error-handler';

type VendurePluginEntry = NonNullable<VendureConfig['plugins']>[number];

/**
 * The observability plugins (ADR 0015), only when the preload started the OpenTelemetry SDK
 * (`OTEL_EXPORTER_OTLP_ENDPOINT`): Vendure's telemetry plugin on every role, which sends the logs over OTLP and keeps
 * a console copy at `LOG_LEVEL`, and the platform gauges on the worker. Neither declares an entity.
 */
export function observabilityPlugins(env: AppEnv, role: ServerRole): VendurePluginEntry[] {
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined) return [];
  const telemetry = TelemetryPlugin.init({ loggerOptions: { logToConsole: VENDURE_LOG_LEVELS[env.LOG_LEVEL] } });
  return role === 'worker' ? [telemetry, PlatformMetricsPlugin] : [telemetry];
}

/** Vendure's error handlers: Sentry when `SENTRY_DSN` is set (the preload started its client), else none. */
export function errorHandlersOf(env: AppEnv): ErrorHandlerStrategy[] {
  return env.SENTRY_DSN === undefined ? [] : [new SentryErrorHandlerStrategy()];
}
