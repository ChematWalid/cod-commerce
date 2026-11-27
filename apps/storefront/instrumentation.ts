import type { Instrumentation } from 'next';
import { isNextBuildPhase } from './cache/cache-config';

/** The storefront's OpenTelemetry service name; the server roles are `cod-api`, `cod-worker`, `cod-migrate`. */
export const STOREFRONT_SERVICE_NAME = 'cod-storefront';

type RequestErrorReporter = NonNullable<Instrumentation.onRequestError>;

let reportRequestError: RequestErrorReporter | undefined;

/** Which telemetry the storefront starts: each part stays off while its variable is unset or blank (ADR 0015). */
export interface StorefrontTelemetry {
  readonly otlp: boolean;
  readonly sentryDsn?: string;
  /** Sentry's environment tag. */
  readonly appEnv?: string;
}

/** Reads the switches from the environment; a blank value counts as unset. */
export function storefrontTelemetryOf(env: Readonly<Record<string, string | undefined>>): StorefrontTelemetry {
  const dsn = env['SENTRY_DSN'];
  const endpoint = env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const appEnv = env['APP_ENV'];
  return {
    otlp: endpoint !== undefined && endpoint !== '',
    ...(dsn === undefined || dsn === '' ? {} : { sentryDsn: dsn }),
    ...(appEnv === undefined ? {} : { appEnv }),
  };
}

/** A Sentry event without what may identify a buyer: request body, query, cookies, headers, user and host name. */
export function scrubStorefrontEvent<T extends { request?: { method?: string; url?: string }; user?: unknown }>(
  event: T,
): T {
  const scrubbed: T = { ...event, server_name: undefined };
  delete scrubbed.user;
  const { request } = event;
  if (request === undefined) return scrubbed;
  return { ...scrubbed, request: { method: request.method, url: request.url?.split('?')[0] } };
}

async function startTelemetry(telemetry: StorefrontTelemetry): Promise<void> {
  if (telemetry.otlp) {
    // The OTLP exporter reads OTEL_EXPORTER_OTLP_ENDPOINT itself; the collector scrubs and samples.
    const { registerOTel } = await import('@vercel/otel');
    registerOTel({ serviceName: STOREFRONT_SERVICE_NAME });
  }
  if (telemetry.sentryDsn !== undefined) {
    const sentry = await import('@sentry/nextjs');
    sentry.init({
      dsn: telemetry.sentryDsn,
      environment: telemetry.appEnv,
      // Nothing about the request or the user is collected; @vercel/otel owns the tracer provider.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      enableOpenTelemetrySetup: false,
      beforeSend: scrubStorefrontEvent,
    });
    reportRequestError = sentry.captureRequestError;
  }
}

/**
 * Runs once when the server starts, before it serves a request: validates the environment and exits on an
 * invalid one (see {@link failFastOnInvalidEnv}), then starts OpenTelemetry and Sentry when their variables are
 * set (ADR 0015). `next build` loads this file too and builds without a Valkey URL or an API, so both are skipped
 * there: the build needs `NEXT_DEPLOYMENT_ID` only, which `next.config.ts` requires.
 */
export async function register(): Promise<void> {
  // The literal `process.env.NEXT_RUNTIME` comparison is what Next replaces at build time, so the edge
  // bundle drops the Node-only import below.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || isNextBuildPhase(process.env)) return;
  const { failFastOnInvalidEnv } = await import('./src/boot/fail-fast-env');
  failFastOnInvalidEnv(process.env);
  await startTelemetry(storefrontTelemetryOf(process.env));
}

/** Server render and route errors go to Sentry once it is started; before that, or without a DSN, nowhere. */
export const onRequestError: RequestErrorReporter = async (...args) => {
  await reportRequestError?.(...args);
};
