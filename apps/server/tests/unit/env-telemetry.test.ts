import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { readTelemetryEnv, TelemetryEnvError } from '../../src/config/telemetry-env';
import { TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...TEST_ENV, ...overrides });
const ZONE = '0123456789abcdef0123456789abcdef';

describe('readTelemetryEnv (the observability preload)', () => {
  it('switches nothing on when neither the OTLP endpoint nor the Sentry DSN is set', () => {
    // Act
    const settings = readTelemetryEnv({
      ROLE: 'api',
      APP_ENV: 'test',
      OTEL_EXPORTER_OTLP_ENDPOINT: '',
      SENTRY_DSN: '',
    });

    // Assert
    expect(settings).toEqual({ role: 'api', appEnv: 'test' });
  });

  it('reads the endpoint and the DSN when they are set', () => {
    // Act
    const settings = readTelemetryEnv({
      ROLE: 'worker',
      APP_ENV: 'staging',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
      SENTRY_DSN: 'https://public@o0.ingest.de.sentry.io/0',
    });

    // Assert
    expect(settings).toEqual({
      role: 'worker',
      appEnv: 'staging',
      otlpEndpoint: 'http://otel-collector:4318',
      sentryDsn: 'https://public@o0.ingest.de.sentry.io/0',
    });
  });

  it('refuses a malformed endpoint and names the variable, not its value', () => {
    // Act
    const read = () => readTelemetryEnv({ ROLE: 'api', APP_ENV: 'test', OTEL_EXPORTER_OTLP_ENDPOINT: 'otel:4318' });

    // Assert
    expect(read).toThrow(TelemetryEnvError);
    expect(read).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(read).not.toThrow('otel:4318');
  });
});

describe('loadEnv observability and CDN purge variables', () => {
  it('leaves every one unset by default', () => {
    // Act
    const env = loadEnv(TEST_ENV);

    // Assert
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined();
  });

  it('takes the Cloudflare token and zone together', () => {
    // Act
    const env = loadEnv({ ...TEST_ENV, CLOUDFLARE_API_TOKEN: 'test-token-grants-nothing', CLOUDFLARE_ZONE_ID: ZONE });

    // Assert
    expect(env.CLOUDFLARE_ZONE_ID).toBe(ZONE);
  });

  it.each([
    [{ CLOUDFLARE_API_TOKEN: 'test-token-grants-nothing' }, 'CLOUDFLARE_ZONE_ID'],
    [{ CLOUDFLARE_ZONE_ID: ZONE }, 'CLOUDFLARE_API_TOKEN'],
  ])('refuses one Cloudflare variable without the other (%o)', (overrides, missing) => {
    // Act and Assert
    expect(issuePaths(failureOf(overrides))).toEqual([missing]);
  });

  it('refuses a zone id that is not 32 hex characters', () => {
    // Act and Assert
    expect(
      issuePaths(failureOf({ CLOUDFLARE_API_TOKEN: 'test-token-grants-nothing', CLOUDFLARE_ZONE_ID: 'example.com' })),
    ).toEqual(['CLOUDFLARE_ZONE_ID']);
  });
});
