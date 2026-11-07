import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LivenessService } from '../application/liveness.service';
import { ReadinessService } from '../application/readiness.service';
import { PROBE_TIMEOUT_MS, type ProbeName } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';
import { startWorkerHealthServer, type WorkerHealthServer } from '../infrastructure/worker-health-server';

/** A probe that passes or fails as the test says. */
const switchable = (name: ProbeName, state: { up: boolean }): ReadinessProbe => ({
  name,
  timeoutMs: PROBE_TIMEOUT_MS[name],
  check: () => (state.up ? Promise.resolve() : Promise.reject(new Error(`${name} is down`))),
});

const start = (postgres: { up: boolean }): Promise<WorkerHealthServer> => {
  const always = { up: true };
  const readiness = new ReadinessService([
    switchable('postgres', postgres),
    switchable('redis', always),
    switchable('migrations', always),
  ]);
  return startWorkerHealthServer({ port: 0, readiness, liveness: new LivenessService(() => 0) });
};

describe('worker health server', () => {
  const postgres = { up: true };
  let server: WorkerHealthServer;
  const url = (path: string): string => `http://127.0.0.1:${String(server.port)}${path}`;

  beforeEach(async () => {
    postgres.up = true;
    server = await start(postgres);
  });

  afterEach(async () => {
    await server.close();
  });

  it('answers /readyz with 200 or 503, following the probes', async () => {
    const ready = await fetch(url('/readyz'));
    postgres.up = false;
    const notReady = await fetch(url('/readyz'));

    expect(ready.status).toBe(200);
    expect(notReady.status).toBe(503);
    expect(await notReady.json()).toMatchObject({ status: 'not_ready', checks: { postgres: { ok: false } } });
  });

  it('answers /livez with 200', async () => {
    const response = await fetch(url('/livez'));

    expect(response.status).toBe(200);
  });

  it('answers an unknown path with 404', async () => {
    const response = await fetch(url('/nope'));

    expect(response.status).toBe(404);
  });

  it('closes', async () => {
    const other = await start(postgres);

    const closing = other.close();

    await expect(closing).resolves.toBeUndefined();
  });
});
