import { monitorEventLoopDelay } from 'node:perf_hooks';

type EventLoopDelayHistogram = ReturnType<typeof monitorEventLoopDelay>;

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/** Measures event-loop lag for the liveness probe, with Node's built-in event-loop delay histogram. */
export class EventLoopLagMonitor {
  private histogram: EventLoopDelayHistogram | undefined;

  /**
   * Starts measuring. Called once the app has booted: boot itself blocks the loop for a while, and that
   * must not fail the first liveness check.
   */
  start(): void {
    this.histogram ??= monitorEventLoopDelay();
    this.histogram.enable();
  }

  stop(): void {
    this.histogram?.disable();
  }

  /** The worst lag, in milliseconds, since the previous sample; 0 before {@link start}. */
  sample(): number {
    if (this.histogram === undefined) {
      return 0;
    }
    const worstMs = this.histogram.max / NANOSECONDS_PER_MILLISECOND;
    this.histogram.reset();
    return worstMs;
  }
}
