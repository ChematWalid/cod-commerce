import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrainService } from '../application/drain.service';
import { JOB_DRAIN_TIMEOUT_MS, REQUEST_DRAIN_TIMEOUT_MS, SHUTDOWN_CLOSE_MARGIN_MS } from '../domain/constants';
import { drainPlanFor } from '../domain/drain';
import { ProcessShutdownWatchdog } from '../infrastructure/process-watchdog';
import { trackInFlightRequests } from '../infrastructure/request-tracker';

const quietLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

const apiDrain = (watchdog = { arm: vi.fn() }, logger = quietLogger()) =>
  new DrainService(drainPlanFor('api'), watchdog, logger);

describe('drainPlanFor (ADR 0013)', () => {
  it('gives the api a 25 s request drain and closes before the 35 s stop grace', () => {
    const plan = drainPlanFor('api');

    expect(plan).toEqual({
      requestDrainMs: REQUEST_DRAIN_TIMEOUT_MS,
      deadlineMs: REQUEST_DRAIN_TIMEOUT_MS + SHUTDOWN_CLOSE_MARGIN_MS,
    });
    expect(plan.deadlineMs).toBeLessThan(35_000);
  });

  it('gives the worker a 60 s job drain and closes before the 75 s stop grace', () => {
    const plan = drainPlanFor('worker');

    expect(plan).toEqual({ requestDrainMs: 0, deadlineMs: JOB_DRAIN_TIMEOUT_MS + SHUTDOWN_CLOSE_MARGIN_MS });
    expect(plan.deadlineMs).toBeLessThan(75_000);
  });

  it('never cuts a migration short', () => {
    expect(drainPlanFor('migrate')).toEqual({ requestDrainMs: 0, deadlineMs: null });
  });
});

describe('DrainService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is draining after a stop signal, and arms the watchdog once with the deadline', () => {
    const watchdog = { arm: vi.fn() };
    const drain = apiDrain(watchdog);

    expect(drain.isDraining).toBe(false);
    drain.onStopSignal('SIGTERM');
    drain.onStopSignal('SIGTERM');
    drain.begin('shutdown');

    expect(drain.isDraining).toBe(true);
    expect(watchdog.arm).toHaveBeenCalledOnce();
    expect(watchdog.arm).toHaveBeenCalledWith(REQUEST_DRAIN_TIMEOUT_MS + SHUTDOWN_CLOSE_MARGIN_MS);
  });

  it('never arms the watchdog on a programmatic close, so a test runner keeps running', () => {
    const watchdog = { arm: vi.fn() };
    const drain = apiDrain(watchdog);

    drain.begin('shutdown');

    expect(drain.isDraining).toBe(true);
    expect(watchdog.arm).not.toHaveBeenCalled();
  });

  it('arms no watchdog for the migrate role', () => {
    const watchdog = { arm: vi.fn() };

    new DrainService(drainPlanFor('migrate'), watchdog, quietLogger()).onStopSignal('SIGTERM');

    expect(watchdog.arm).not.toHaveBeenCalled();
  });

  it('waits for the in-flight requests to finish', async () => {
    const drain = apiDrain();
    const finish = drain.requestStarted();
    drain.begin('shutdown');

    let settled = false;
    const waiting = drain.waitForRequests().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    const settledBeforeFinish = settled;
    finish();
    await waiting;

    expect(settledBeforeFinish).toBe(false);
    expect(settled).toBe(true);
  });

  it('counts a finished request once, however often it reports', async () => {
    const drain = apiDrain();
    const first = drain.requestStarted();
    drain.requestStarted();
    first();
    first();

    let settled = false;
    void drain.waitForRequests().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(drain.inFlight).toBe(1);
    expect(settled).toBe(false);
  });

  it('stops waiting after 25 s and logs how many requests were cut', async () => {
    const logger = quietLogger();
    const drain = apiDrain({ arm: vi.fn() }, logger);
    drain.requestStarted();

    const waiting = drain.waitForRequests();
    await vi.advanceTimersByTimeAsync(REQUEST_DRAIN_TIMEOUT_MS);
    await waiting;

    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/1 request/), expect.any(String));
  });

  it('resolves at once when nothing is in flight', async () => {
    await expect(apiDrain().waitForRequests()).resolves.toBeUndefined();
  });
});

describe('ProcessShutdownWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends the process with a logged error when shutdown outlives the deadline', () => {
    const exit = vi.fn();
    const logger = quietLogger();

    new ProcessShutdownWatchdog(exit, logger).arm(30_000);
    vi.advanceTimersByTime(29_999);
    const exitedEarly = exit.mock.calls.length > 0;
    vi.advanceTimersByTime(1);

    expect(exitedEarly).toBe(false);
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe('trackInFlightRequests', () => {
  it('counts a request from its arrival until its response closes', () => {
    const drain = apiDrain();
    const server = new EventEmitter();
    const response = new EventEmitter();

    trackInFlightRequests(server, drain);
    server.emit('request', {}, response);
    const during = drain.inFlight;
    response.emit('close');

    expect(during).toBe(1);
    expect(drain.inFlight).toBe(0);
  });
});
