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

/** A Node HTTP server stand-in: request events, plus the listener and idle-socket closes the drain calls. */
class FakeServer extends EventEmitter {
  readonly close = vi.fn();
  readonly closeIdleConnections = vi.fn();
}

/** A Node HTTP response stand-in: its close event and the headers set on it. */
class FakeResponse extends EventEmitter {
  readonly headers = new Map<string, string>();
  constructor(public headersSent = false) {
    super();
  }
  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }
}

describe('trackInFlightRequests', () => {
  it('counts a request from its arrival until its response closes', () => {
    const drain = apiDrain();
    const server = new FakeServer();
    const response = new FakeResponse();

    trackInFlightRequests(server, drain);
    server.emit('request', {}, response);
    const during = drain.inFlight;
    response.emit('close');

    expect(during).toBe(1);
    expect(drain.inFlight).toBe(0);
  });

  it('keeps connections alive while the process is not draining', () => {
    const server = new FakeServer();
    const response = new FakeResponse();

    trackInFlightRequests(server, apiDrain());
    server.emit('request', {}, response);

    expect(response.headers.has('connection')).toBe(false);
    expect(server.close).not.toHaveBeenCalled();
  });

  it('stops accepting connections and closes the idle ones as soon as the drain begins', () => {
    const drain = apiDrain();
    const server = new FakeServer();

    trackInFlightRequests(server, drain);
    drain.onStopSignal('SIGTERM');
    drain.begin('shutdown');

    expect(server.close).toHaveBeenCalledOnce();
    expect(server.closeIdleConnections).toHaveBeenCalledOnce();
  });

  it('closes the connection of a request that arrives on a kept-alive socket after the drain began', () => {
    const drain = apiDrain();
    const server = new FakeServer();
    const late = new FakeResponse();

    trackInFlightRequests(server, drain);
    drain.begin('shutdown');
    server.emit('request', {}, late);

    expect(late.headers.get('connection')).toBe('close');
  });

  it('closes the connection of each request in flight when the drain begins, so its socket carries no other', () => {
    const drain = apiDrain();
    const server = new FakeServer();
    const pending = new FakeResponse();
    const streaming = new FakeResponse();
    const done = new FakeResponse();

    trackInFlightRequests(server, drain);
    server.emit('request', {}, pending);
    server.emit('request', {}, streaming);
    server.emit('request', {}, done);
    done.emit('close');
    streaming.headersSent = true;
    drain.begin('shutdown');

    expect(pending.headers.get('connection')).toBe('close');
    expect(streaming.headers.has('connection')).toBe(false);
    expect(done.headers.has('connection')).toBe(false);
  });

  it('ends the request drain once the in-flight requests finish, since no new connection is accepted', async () => {
    vi.useFakeTimers();
    try {
      const drain = apiDrain();
      const server = new FakeServer();
      const response = new FakeResponse();
      trackInFlightRequests(server, drain);
      server.emit('request', {}, response);

      drain.begin('shutdown');
      const waiting = drain.waitForRequests();
      await vi.advanceTimersByTimeAsync(100);
      response.emit('close');
      await waiting;

      expect(drain.inFlight).toBe(0);
      expect(server.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DrainService.onBegin', () => {
  it('runs a listener when the drain begins, once, and at once when it has already begun', () => {
    const drain = apiDrain();
    const before = vi.fn();
    const after = vi.fn();

    drain.onBegin(before);
    drain.begin('SIGTERM');
    drain.begin('shutdown');
    drain.onBegin(after);

    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
  });
});
