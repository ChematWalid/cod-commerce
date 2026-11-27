import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toHealthResponse } from '../api/health-response';
import { ReadinessService } from '../application/readiness.service';
import { DRAINING_CODE, PROBE_TIMEOUT_MS, READINESS_CACHE_TTL_MS, type ProbeName } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';

const silent = () => ({ error: vi.fn() });

/** A probe that counts its runs and passes or fails as `state` says. */
const counted = (name: ProbeName, state: { up: boolean; runs: number }): ReadinessProbe => ({
  name,
  timeoutMs: PROBE_TIMEOUT_MS[name],
  check: () => {
    state.runs += 1;
    return state.up ? Promise.resolve() : Promise.reject(new Error(`${name} down`));
  },
});

const probesOf = (state: { up: boolean; runs: number }): ReadinessProbe[] => [
  counted('postgres', state),
  counted('redis', { up: true, runs: 0 }),
  counted('migrations', { up: true, runs: 0 }),
];

describe('ReadinessService while draining', () => {
  it('answers 503 draining at once after the drain began, without probing', async () => {
    const postgres = { up: true, runs: 0 };
    const drain = { isDraining: false };
    const service = new ReadinessService(probesOf(postgres), silent(), { drain });

    const before = toHealthResponse(await service.check());
    drain.isDraining = true;
    const during = toHealthResponse(await service.check());

    expect(before.statusCode).toBe(200);
    expect(during.statusCode).toBe(503);
    expect(during.body.status).toBe('not_ready');
    expect(Object.values(during.body.checks).map((check) => check.error)).toEqual([
      DRAINING_CODE,
      DRAINING_CODE,
      DRAINING_CODE,
    ]);
    expect(postgres.runs).toBe(1);
  });

  it('ignores a cached ready result once draining', async () => {
    const drain = { isDraining: false };
    const service = new ReadinessService(probesOf({ up: true, runs: 0 }), silent(), {
      drain,
      cacheTtlMs: READINESS_CACHE_TTL_MS,
    });

    await service.check();
    drain.isDraining = true;
    const report = await service.check();

    expect(report.status).toBe('not_ready');
  });
});

describe('ReadinessService result cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the same result within the cache window and probes once', async () => {
    const postgres = { up: true, runs: 0 };
    const service = new ReadinessService(probesOf(postgres), silent(), { cacheTtlMs: READINESS_CACHE_TTL_MS });

    const first = await service.check();
    postgres.up = false;
    vi.advanceTimersByTime(READINESS_CACHE_TTL_MS - 1);
    const second = await service.check();

    expect(second).toEqual(first);
    expect(postgres.runs).toBe(1);
  });

  it('probes again once the window has passed', async () => {
    const postgres = { up: true, runs: 0 };
    const service = new ReadinessService(probesOf(postgres), silent(), { cacheTtlMs: READINESS_CACHE_TTL_MS });

    await service.check();
    postgres.up = false;
    vi.advanceTimersByTime(READINESS_CACHE_TTL_MS);
    const later = await service.check();

    expect(later.status).toBe('not_ready');
    expect(postgres.runs).toBe(2);
  });

  it('shares one probe round between concurrent callers', async () => {
    const postgres = { up: true, runs: 0 };
    const service = new ReadinessService(probesOf(postgres), silent(), { cacheTtlMs: READINESS_CACHE_TTL_MS });

    const reports = await Promise.all([service.check(), service.check(), service.check()]);

    expect(new Set(reports.map((report) => report.status))).toEqual(new Set(['ready']));
    expect(postgres.runs).toBe(1);
  });

  it('caches nothing by default, so every call probes', async () => {
    const postgres = { up: true, runs: 0 };
    const service = new ReadinessService(probesOf(postgres), silent());

    await service.check();
    await service.check();

    expect(postgres.runs).toBe(2);
  });
});
