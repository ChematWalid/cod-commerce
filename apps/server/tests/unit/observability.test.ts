import { PlatformMetricsPlugin } from '@cod/plugin-platform-metrics';
import { ForbiddenError, type Job } from '@vendure/core';
import { TelemetryPlugin } from '@vendure/telemetry-plugin';
import type { ErrorEvent } from '@sentry/node';
import { describe, expect, it } from 'vitest';
import { loadEnv, type ServerRole } from '../../src/config/env';
import { errorHandlersOf, observabilityPlugins } from '../../src/config/observability.config';
import { scrubEvent } from '../../src/config/observability/error-reporting';
import { resourceAttributesOf } from '../../src/config/observability/open-telemetry';
import { SentryErrorHandlerStrategy } from '../../src/config/observability/sentry-error-handler';
import { TEST_ENV } from '../support/deployed-env.fixture';

const OTEL_ENV = { ...TEST_ENV, OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318' };

const isTelemetry = (plugin: unknown): boolean =>
  plugin === TelemetryPlugin || (typeof plugin === 'function' && plugin.name === TelemetryPlugin.name);

describe('observabilityPlugins', () => {
  it.each<ServerRole>(['api', 'worker', 'migrate'])(
    'registers nothing on %s while the OTLP endpoint is unset',
    (role) => {
      // Act
      const plugins = observabilityPlugins(loadEnv({ ...TEST_ENV, ROLE: role }), role);

      // Assert
      expect(plugins).toEqual([]);
    },
  );

  it('registers the telemetry plugin and the platform gauges on the worker once the endpoint is set', () => {
    // Act
    const plugins = observabilityPlugins(loadEnv({ ...OTEL_ENV, ROLE: 'worker' }), 'worker');

    // Assert
    expect(plugins.some(isTelemetry)).toBe(true);
    expect(plugins).toContain(PlatformMetricsPlugin);
  });

  it('keeps the platform gauges off the api: one role reports the platform-wide values', () => {
    // Act
    const plugins = observabilityPlugins(loadEnv({ ...OTEL_ENV, ROLE: 'api' }), 'api');

    // Assert
    expect(plugins.some(isTelemetry)).toBe(true);
    expect(plugins).not.toContain(PlatformMetricsPlugin);
  });
});

describe('errorHandlersOf', () => {
  it('adds no handler without a Sentry DSN, and the Sentry one with it', () => {
    // Act
    const without = errorHandlersOf(loadEnv(TEST_ENV));
    const withDsn = errorHandlersOf(loadEnv({ ...TEST_ENV, SENTRY_DSN: 'https://public@o0.ingest.de.sentry.io/0' }));

    // Assert
    expect(without).toEqual([]);
    expect(withDsn).toEqual([expect.any(SentryErrorHandlerStrategy)]);
  });
});

describe('SentryErrorHandlerStrategy', () => {
  const setUp = () => {
    const captured: { message: string; tags: Readonly<Record<string, string>> }[] = [];
    const strategy = new SentryErrorHandlerStrategy((error, tags) => captured.push({ message: error.message, tags }));
    return { captured, strategy };
  };

  it('reports an unexpected api error', () => {
    // Arrange
    const { captured, strategy } = setUp();

    // Act
    strategy.handleServerError(new Error('boom'));

    // Assert
    expect(captured).toEqual([{ message: 'boom', tags: { source: 'api' } }]);
  });

  it('leaves out an error the caller caused, such as a forbidden request', () => {
    // Arrange
    const { captured, strategy } = setUp();

    // Act
    strategy.handleServerError(new ForbiddenError());

    // Assert
    expect(captured).toEqual([]);
  });

  it('reports a failed job with its queue name and without its data', () => {
    // Arrange
    const { captured, strategy } = setUp();
    const job = { queueName: 'dispatch', data: { phone: '0555000000' } } as unknown as Job;

    // Act
    strategy.handleWorkerError(new Error('carrier down'), { job });

    // Assert
    expect(captured).toEqual([{ message: 'carrier down', tags: { source: 'worker', queue: 'dispatch' } }]);
  });
});

describe('scrubEvent', () => {
  it('drops the body, query, cookies, headers, user and host name of an error event', () => {
    // Arrange
    const event: ErrorEvent = {
      type: undefined,
      message: 'boom',
      server_name: 'node-1',
      user: { ip_address: '192.0.2.1' },
      request: {
        method: 'POST',
        url: 'https://shop.example.dz/api/store/orders?phone=0555000000',
        data: { phone: '0555000000' },
        query_string: 'phone=0555000000',
        cookies: { session: 'x' },
        headers: { cookie: 'session=x' },
      },
    };

    // Act
    const scrubbed = scrubEvent(event);

    // Assert
    expect(scrubbed).toEqual({
      type: undefined,
      message: 'boom',
      request: { method: 'POST', url: 'https://shop.example.dz/api/store/orders' },
    });
  });
});

describe('resourceAttributesOf', () => {
  it('names the service by role and environment, without a host', () => {
    // Act
    const attributes = resourceAttributesOf({ role: 'worker', appEnv: 'staging' });

    // Assert
    expect(attributes).toEqual({
      'service.name': 'cod-worker',
      'service.namespace': 'cod',
      'deployment.environment.name': 'staging',
    });
  });
});
