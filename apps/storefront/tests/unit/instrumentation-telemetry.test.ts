import { describe, expect, it } from 'vitest';
import { onRequestError, scrubStorefrontEvent, storefrontTelemetryOf } from '../../instrumentation';

describe('storefrontTelemetryOf', () => {
  it('starts neither OpenTelemetry nor Sentry while their variables are unset or blank', () => {
    // Act
    const unset = storefrontTelemetryOf({});
    const blank = storefrontTelemetryOf({ OTEL_EXPORTER_OTLP_ENDPOINT: '', SENTRY_DSN: '' });

    // Assert
    expect(unset).toEqual({ otlp: false });
    expect(blank).toEqual({ otlp: false });
  });

  it('starts both when the endpoint and the DSN are set', () => {
    // Act
    const telemetry = storefrontTelemetryOf({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
      SENTRY_DSN: 'https://public@o0.ingest.de.sentry.io/0',
    });

    // Assert
    expect(telemetry).toEqual({ otlp: true, sentryDsn: 'https://public@o0.ingest.de.sentry.io/0' });
  });
});

describe('scrubStorefrontEvent', () => {
  it('keeps only the method and the path of the request, and drops the user and host name', () => {
    // Arrange
    const event = {
      message: 'render failed',
      server_name: 'node-1',
      user: { ip_address: '192.0.2.1' },
      request: { method: 'GET', url: 'https://shop.example.dz/ar/checkout?phone=0555000000', cookies: { s: 'x' } },
    };

    // Act
    const scrubbed = scrubStorefrontEvent(event);

    // Assert
    expect(scrubbed).toEqual({
      message: 'render failed',
      server_name: undefined,
      request: { method: 'GET', url: 'https://shop.example.dz/ar/checkout' },
    });
  });
});

describe('onRequestError', () => {
  it('reports nowhere before Sentry is started', async () => {
    // Act
    const result = onRequestError(
      new Error('boom'),
      { path: '/ar', method: 'GET', headers: {} },
      {
        routerKind: 'App Router',
        routePath: '/ar',
        routeType: 'render',
        renderSource: 'react-server-components',
        revalidateReason: undefined,
      },
    );

    // Assert
    await expect(result).resolves.toBeUndefined();
  });
});
