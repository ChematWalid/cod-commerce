/**
 * The observability preload (ADR 0015), required by the image's entry point before the server's own code:
 * `node --require ./apps/server/dist/config/otel.js apps/server/dist/main-<role>.js`. It starts Sentry when
 * `SENTRY_DSN` is set and the OpenTelemetry SDK when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; with neither it loads
 * nothing more. The SDK must patch `http`, `pg` and `ioredis` before the server imports them, so this file runs
 * before `loadEnv` and reads its few variables itself.
 */
import { readTelemetryEnv } from './telemetry-env';

const settings = readTelemetryEnv(process.env);

// The SDKs are loaded only when switched on, and synchronously: an `import()` would resolve after the server's
// modules were already loaded, unpatched. A static import would load both SDKs into every process.
if (settings.sentryDsn !== undefined) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only when switched on, before the server
  const { startErrorReporting } =
    require('./observability/error-reporting') as typeof import('./observability/error-reporting');
  startErrorReporting(settings.sentryDsn, settings);
}
if (settings.otlpEndpoint !== undefined) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only when switched on, before the server
  const { startOpenTelemetry } =
    require('./observability/open-telemetry') as typeof import('./observability/open-telemetry');
  startOpenTelemetry(settings);
}
