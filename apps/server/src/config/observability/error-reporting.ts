import { type ErrorEvent, init, type NodeOptions } from '@sentry/node';
import type { TelemetrySettings } from '../telemetry-env';

/** Request parts that can carry a buyer's phone, name, address or a session: never sent (ADR 0015 "PII scrubbing"). */
type ScrubbedRequest = NonNullable<ErrorEvent['request']>;

const withoutQuery = (url: string | undefined): string | undefined => url?.split('?')[0];

/**
 * Drops what may identify a buyer or a session before an event leaves the process: the request body, query string,
 * cookies and headers, the user and the host name. Exception messages and stack traces stay.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const rest: ErrorEvent = { ...event };
  delete rest.user;
  delete rest.server_name;
  const { request } = event;
  if (request === undefined) return rest;
  const scrubbed: ScrubbedRequest = { method: request.method, url: withoutQuery(request.url) };
  return { ...rest, request: scrubbed };
}

/**
 * Nothing about the request or the user is collected (Sentry 11 collects all of it by default); `scrubEvent` drops
 * what an integration might still attach.
 */
export const SENTRY_DATA_COLLECTION: NonNullable<NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  databaseQueryData: false,
  queues: false,
};

/**
 * Starts the Sentry client for uncaught errors and the ones Vendure's error handler forwards (ADR 0015). It registers no
 * OpenTelemetry provider and no module hooks of its own and sends no traces: the OTel SDK owns tracing, so the two
 * never patch modules twice.
 */
export function startErrorReporting(dsn: string, settings: TelemetrySettings): void {
  init({
    dsn,
    environment: settings.appEnv,
    dataCollection: SENTRY_DATA_COLLECTION,
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    initialScope: { tags: { role: settings.role } },
    beforeSend: scrubEvent,
  });
}
