import { afterEach, describe, expect, it } from 'vitest';
import { EventLoopLagMonitor } from '../infrastructure/event-loop-lag.monitor';

const STALL_MS = 150;
const WINDOW_MS = 60_000;

const blockEventLoop = (ms: number): void => {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Busy-wait on purpose: the test needs a real event-loop stall.
  }
};

const nextTicks = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('EventLoopLagMonitor', () => {
  let monitor: EventLoopLagMonitor | undefined;

  afterEach(() => {
    monitor?.stop();
  });

  it('reports one stall to every reader, not only to the first', async () => {
    monitor = new EventLoopLagMonitor(WINDOW_MS);
    monitor.start();
    await nextTicks(30);

    blockEventLoop(STALL_MS);
    await nextTicks(30);
    const first = monitor.sample();
    const second = monitor.sample();

    expect(first).toBeGreaterThanOrEqual(STALL_MS * 0.8);
    expect(second).toBe(first);
  });

  it('forgets a stall once two windows have passed without one', async () => {
    const shortWindowMs = 100;
    monitor = new EventLoopLagMonitor(shortWindowMs);
    monitor.start();
    await nextTicks(30);

    blockEventLoop(STALL_MS);
    await nextTicks(shortWindowMs * 3);

    expect(monitor.sample()).toBeLessThan(STALL_MS * 0.8);
  });

  it('reports no lag before it starts', () => {
    monitor = new EventLoopLagMonitor(WINDOW_MS);

    expect(monitor.sample()).toBe(0);
  });
});
