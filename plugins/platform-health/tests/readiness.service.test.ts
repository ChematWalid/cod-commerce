import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toHealthResponse } from '../api/health-response';
import { LivenessService } from '../application/liveness.service';
import { ReadinessService } from '../application/readiness.service';
import {
  LOGGER_CONTEXT,
  PROBE_FAILED_CODE,
  PROBE_FAILURE_LOG_INTERVAL_MS,
  PROBE_TIMEOUT_MS,
  type ProbeName,
} from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';
import { MigrationsProbe } from '../infrastructure/migrations.probe';
import { PostgresProbe } from '../infrastructure/postgres.probe';

const silent = () => ({ error: vi.fn() });

const passing = (name: ProbeName): ReadinessProbe => ({
  name,
  timeoutMs: PROBE_TIMEOUT_MS[name],
  check: () => Promise.resolve(),
});

const failing = (name: ProbeName, message: string): ReadinessProbe => ({
  ...passing(name),
  check: () => Promise.reject(new Error(message)),
});

const hanging = (name: ProbeName): ReadinessProbe => ({
  ...passing(name),
  check: () => new Promise<void>(() => undefined),
});

/** A data source whose code knows migration `M1`, and whose migrations table holds `executed`. */
const migrationSource = (executed: string[]) => ({
  options: {},
  migrations: [{ name: 'M1' }],
  query: () => Promise.resolve(executed.map((name) => ({ name }))),
});

describe('ReadinessService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is ready when every probe passes', async () => {
    const service = new ReadinessService([passing('postgres'), passing('redis'), passing('migrations')], silent());

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('is not ready when postgres fails', async () => {
    const service = new ReadinessService(
      [failing('postgres', 'connect ECONNREFUSED'), passing('redis'), passing('migrations')],
      silent(),
    );

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(503);
    expect(response.body.checks.postgres).toMatchObject({ ok: false, error: PROBE_FAILED_CODE });
    expect(response.body.checks.redis.ok).toBe(true);
  });

  it('keeps the driver error, with its host, out of the response body', async () => {
    const driverError = 'connect ECONNREFUSED db-primary.internal:5432 (user cod_app)';
    const service = new ReadinessService(
      [failing('postgres', driverError), passing('redis'), passing('migrations')],
      silent(),
    );

    const body = JSON.stringify(toHealthResponse(await service.check()).body);

    expect(body).not.toContain('db-primary.internal');
    expect(body).not.toContain('5432');
    expect(body).not.toContain('cod_app');
  });

  it('logs each failed probe once, with its name and full error', async () => {
    const logger = silent();
    const driverError = 'connect ECONNREFUSED db-primary.internal:5432';
    const service = new ReadinessService(
      [failing('postgres', driverError), passing('redis'), passing('migrations')],
      logger,
    );

    await service.check();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/"postgres".*db-primary\.internal:5432/),
      LOGGER_CONTEXT,
    );
  });

  it('logs a probe that keeps failing once per interval, not once per request', async () => {
    const logger = silent();
    const service = new ReadinessService(
      [failing('postgres', 'down'), passing('redis'), passing('migrations')],
      logger,
    );

    await service.check();
    await service.check();
    vi.advanceTimersByTime(PROBE_FAILURE_LOG_INTERVAL_MS);
    await service.check();

    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs each failing probe on its own interval', async () => {
    const logger = silent();
    const service = new ReadinessService(
      [failing('postgres', 'down'), failing('redis', 'down'), passing('migrations')],
      logger,
    );

    await service.check();

    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs nothing when every probe passes', async () => {
    const logger = silent();
    const service = new ReadinessService([passing('postgres'), passing('redis'), passing('migrations')], logger);

    await service.check();

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('aborts the signal of a probe that timed out, so it can cancel its work', async () => {
    let received: AbortSignal | undefined;
    const capturing: ReadinessProbe = {
      ...passing('postgres'),
      check: (signal) => {
        received = signal;
        return new Promise<void>(() => undefined);
      },
    };
    const service = new ReadinessService([capturing, passing('redis'), passing('migrations')], silent());

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS.postgres);
    await pending;

    expect(received?.aborted).toBe(true);
  });

  it('leaves the signal of a probe that settled in time alone', async () => {
    let received: AbortSignal | undefined;
    const capturing: ReadinessProbe = {
      ...passing('postgres'),
      check: (signal) => {
        received = signal;
        return Promise.resolve();
      },
    };
    const service = new ReadinessService([capturing, passing('redis'), passing('migrations')], silent());

    await service.check();
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS.postgres);

    expect(received?.aborted).toBe(false);
  });

  it('times a hanging redis probe out at 200 ms', async () => {
    const service = new ReadinessService([passing('postgres'), hanging('redis'), passing('migrations')], silent());

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS.redis);
    const report = await pending;

    expect(report.status).toBe('not_ready');
    expect(report.checks.redis).toEqual({ ok: false, durationMs: 200, error: 'platform-health.probe-timeout' });
  });

  it('is not ready while migrations are pending', async () => {
    const migrations = new MigrationsProbe(migrationSource([]));
    const service = new ReadinessService([passing('postgres'), passing('redis'), migrations], silent());

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(503);
    expect(response.body.checks.migrations).toMatchObject({ ok: false, error: 'platform-health.pending-migrations' });
  });

  it('stops asking for migrations once none are pending', async () => {
    const source = migrationSource(['M1']);
    const query = vi.spyOn(source, 'query');
    const service = new ReadinessService(
      [passing('postgres'), passing('redis'), new MigrationsProbe(source)],
      silent(),
    );

    await service.check();
    const second = await service.check();

    expect(second.status).toBe('ready');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('LivenessService', () => {
  it('liveness fails above 1000 ms event-loop lag', () => {
    const lagging = new LivenessService(() => 1500);
    const healthy = new LivenessService(() => 20);

    const laggingResponse = toHealthResponse(lagging.check());
    const healthyResponse = toHealthResponse(healthy.check());

    expect(laggingResponse.statusCode).toBe(503);
    expect(healthyResponse.statusCode).toBe(200);
  });
});

describe('PostgresProbe', () => {
  it('bounds its query with a statement timeout equal to its budget, so Postgres cancels it', async () => {
    const query = vi.fn((sql: string) => Promise.resolve([sql]));

    await new PostgresProbe({ query }).check();

    expect(query).toHaveBeenCalledWith(`SET LOCAL statement_timeout = ${String(PROBE_TIMEOUT_MS.postgres)}; SELECT 1`);
  });

  it('does not start its query once its signal is aborted', async () => {
    const query = vi.fn((sql: string) => Promise.resolve([sql]));

    const outcome = await new PostgresProbe({ query }).check(AbortSignal.abort()).catch((error: unknown) => error);

    expect(outcome).toBeInstanceOf(Error);
    expect(query).not.toHaveBeenCalled();
  });
});
