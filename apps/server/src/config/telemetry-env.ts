import { z } from 'zod';
import { SERVER_ROLES, type ServerRole } from './roles';

const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const isHttpUrl = (value: string): boolean => URL.canParse(value) && HTTP_PROTOCOLS.includes(new URL(value).protocol);
const httpUrl = z.string().refine(isHttpUrl, 'must be an http:// or https:// URL');

/**
 * The observability variables (ADR 0015), spread into the server's schema. Each feature is off while its variable
 * is unset: no OpenTelemetry SDK, no Sentry client, no Cloudflare purge (D3506).
 */
export const telemetryEnvShape = {
  // The OTLP/HTTP endpoint of the node's collector (compose: http://otel-collector:4318). The SDK appends /v1/….
  OTEL_EXPORTER_OTLP_ENDPOINT: httpUrl.optional(),
  // Sentry's project DSN (EU region). It names a project, it grants no read access, but it stays out of the repo.
  SENTRY_DSN: httpUrl.optional(),
  // The Cloudflare purge (D3210): a token limited to Cache Purge on the zone, and the zone id. Both or neither.
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_ZONE_ID: z
    .string()
    .regex(/^[0-9a-f]{32}$/, 'must be a Cloudflare zone id (32 hex characters)')
    .optional(),
};

/** The parts of the environment {@link requireCloudflarePair} reads. */
interface CloudflareEnv {
  readonly CLOUDFLARE_API_TOKEN?: string | undefined;
  readonly CLOUDFLARE_ZONE_ID?: string | undefined;
}

/** A token without a zone (or the reverse) would leave the purge silently off, so boot refuses it. */
export function requireCloudflarePair(env: CloudflareEnv, context: z.RefinementCtx): void {
  if ((env.CLOUDFLARE_API_TOKEN === undefined) === (env.CLOUDFLARE_ZONE_ID === undefined)) return;
  context.addIssue({
    code: 'custom',
    path: [env.CLOUDFLARE_API_TOKEN === undefined ? 'CLOUDFLARE_API_TOKEN' : 'CLOUDFLARE_ZONE_ID'],
    message: 'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are set together or not at all',
  });
}

/** What the preload needs before `loadEnv` runs: which telemetry to start and how to name the process. */
export interface TelemetrySettings {
  readonly role: ServerRole;
  readonly appEnv: string;
  readonly otlpEndpoint?: string;
  readonly sentryDsn?: string;
}

const preloadSchema = z.object({
  ROLE: z.enum(SERVER_ROLES),
  APP_ENV: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: telemetryEnvShape.OTEL_EXPORTER_OTLP_ENDPOINT,
  SENTRY_DSN: telemetryEnvShape.SENTRY_DSN,
});

/** The preload's settings are invalid; the issues carry variable names and rules, never values. */
export class TelemetryEnvError extends Error {
  constructor(issues: readonly string[]) {
    super(`Invalid telemetry environment:\n${issues.map((issue) => `  ${issue}`).join('\n')}`);
    this.name = 'TelemetryEnvError';
  }
}

/**
 * Reads the telemetry settings for the preload (`config/otel.ts`), which runs before `loadEnv`: the SDK must patch
 * modules before the server loads them. `loadEnv` validates the same variables again with the full schema.
 *
 * @throws {TelemetryEnvError} when a variable is invalid; a blank one counts as unset.
 */
export function readTelemetryEnv(source: Readonly<Record<string, string | undefined>>): TelemetrySettings {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = preloadSchema.safeParse(present);
  if (!result.success) {
    throw new TelemetryEnvError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const env = result.data;
  return {
    role: env.ROLE,
    appEnv: env.APP_ENV,
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined ? {} : { otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    ...(env.SENTRY_DSN === undefined ? {} : { sentryDsn: env.SENTRY_DSN }),
  };
}
