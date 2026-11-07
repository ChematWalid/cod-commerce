import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toHealthResponse } from '../api/health-response';
import { LivenessService } from '../application/liveness.service';
import { ReadinessService } from '../application/readiness.service';
import { PROBE_TIMEOUT_MS, type ProbeName } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';
import { MigrationsProbe } from '../infrastructure/migrations.probe';

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

/** A migration source whose answer the test changes between checks. */
const migrationSource = (pending: boolean[]): { showMigrations: () => Promise<boolean> } => ({
  showMigrations: () => Promise.resolve(pending.shift() ?? false),
});

describe('ReadinessService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is ready when every probe passes', async () => {
    const service = new ReadinessService([passing('postgres'), passing('redis'), passing('migrations')]);

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('is not ready when postgres fails', async () => {
    const service = new ReadinessService([
      failing('postgres', 'connect ECONNREFUSED'),
      passing('redis'),
      passing('migrations'),
    ]);

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(503);
    expect(response.body.checks.postgres).toMatchObject({ ok: false, error: 'connect ECONNREFUSED' });
    expect(response.body.checks.redis.ok).toBe(true);
  });

  it('times a hanging redis probe out at 200 ms', async () => {
    const service = new ReadinessService([passing('postgres'), hanging('redis'), passing('migrations')]);

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS.redis);
    const report = await pending;

    expect(report.status).toBe('not_ready');
    expect(report.checks.redis).toEqual({ ok: false, durationMs: 200, error: 'timed out after 200 ms' });
  });

  it('is not ready while migrations are pending', async () => {
    const migrations = new MigrationsProbe(migrationSource([true]));
    const service = new ReadinessService([passing('postgres'), passing('redis'), migrations]);

    const response = toHealthResponse(await service.check());

    expect(response.statusCode).toBe(503);
    expect(response.body.checks.migrations).toMatchObject({ ok: false, error: 'migrations are pending' });
  });

  it('stops asking for migrations once none are pending', async () => {
    const source = migrationSource([false]);
    const showMigrations = vi.spyOn(source, 'showMigrations');
    const service = new ReadinessService([passing('postgres'), passing('redis'), new MigrationsProbe(source)]);

    await service.check();
    const second = await service.check();

    expect(second.status).toBe('ready');
    expect(showMigrations).toHaveBeenCalledTimes(1);
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
