import { monitorEventLoopDelay } from 'node:perf_hooks';
import { EVENT_LOOP_LAG_WINDOW_MS } from '../domain/constants';

type EventLoopDelayHistogram = ReturnType<typeof monitorEventLoopDelay>;

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/**
 * Measures event-loop lag for the liveness probe, with Node's built-in event-loop delay histogram.
 * The histogram is reset on a fixed timer, never by a reader, so any number of `/livez` callers see the same
 * stall: the worst lag of the current and the previous window.
 */
export class EventLoopLagMonitor {
  private histogram: EventLoopDelayHistogram | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private previousWindowMaxMs = 0;

  constructor(private readonly windowMs: number = EVENT_LOOP_LAG_WINDOW_MS) {}

  /**
   * Starts measuring. Called once the app has booted: boot itself blocks the loop for a while, and that
   * must not fail the first liveness check.
   */
  start(): void {
    this.histogram ??= monitorEventLoopDelay();
    this.histogram.enable();
    this.timer ??= setInterval(() => {
      this.rotateWindow();
    }, this.windowMs);
    this.timer.unref();
  }

  stop(): void {
    this.histogram?.disable();
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** The worst lag, in milliseconds, of the last one to two windows; 0 before {@link start}. Does not reset. */
  sample(): number {
    if (this.histogram === undefined) {
      return 0;
    }
    return Math.max(this.previousWindowMaxMs, this.currentWindowMaxMs(this.histogram));
  }

  private rotateWindow(): void {
    if (this.histogram === undefined) {
      return;
    }
    this.previousWindowMaxMs = this.currentWindowMaxMs(this.histogram);
    this.histogram.reset();
  }

  private currentWindowMaxMs(histogram: EventLoopDelayHistogram): number {
    return histogram.max / NANOSECONDS_PER_MILLISECOND;
  }
}
