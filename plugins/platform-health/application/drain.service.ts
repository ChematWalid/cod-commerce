import { LOGGER_CONTEXT } from '../domain/constants';
import type { DrainPlan } from '../domain/drain';
import type { DrainLogger, DrainSignal, ShutdownWatchdog } from '../domain/ports';

/**
 * The process's drain state (ADR 0013): SIGTERM flips it, `/readyz` then fails at once, and the shutdown waits
 * for the in-flight requests (bounded by the plan) before Vendure closes its queues, event bus and DB.
 */
export class DrainService implements DrainSignal {
  private draining = false;
  private deadlineArmed = false;
  private active = 0;
  private readonly idleWaiters = new Set<() => void>();
  private readonly beginListeners: (() => void)[] = [];

  constructor(
    private readonly plan: DrainPlan,
    private readonly watchdog: ShutdownWatchdog,
    private readonly logger: DrainLogger,
  ) {}

  get isDraining(): boolean {
    return this.draining;
  }

  /** The number of requests that arrived and whose response has not closed yet. */
  get inFlight(): number {
    return this.active;
  }

  /** Starts the drain and runs the {@link onBegin} listeners; later calls do nothing. */
  begin(reason: string): void {
    if (this.draining) return;
    this.draining = true;
    this.logger.info(`Draining (${reason}): /readyz now answers 503`, LOGGER_CONTEXT);
    this.beginListeners.splice(0).forEach((listener) => {
      listener();
    });
  }

  /** Runs `listener` once when the drain begins, or at once when it already has. */
  onBegin(listener: () => void): void {
    if (this.draining) {
      listener();
      return;
    }
    this.beginListeners.push(listener);
  }

  /**
   * The orchestrator asked the process to stop: drain, and arm the plan's deadline once. A programmatic close
   * (tests, `app.close()`) only calls {@link begin}, so it never ends a process that keeps running.
   */
  onStopSignal(signal: string): void {
    const first = !this.deadlineArmed;
    this.deadlineArmed = true;
    this.begin(signal);
    if (first && this.plan.deadlineMs !== null) {
      this.watchdog.arm(this.plan.deadlineMs);
    }
  }

  /** Counts one request in; the returned function counts it out, once however often it is called. */
  requestStarted(): () => void {
    this.active += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.active -= 1;
      if (this.active === 0) this.wakeIdleWaiters();
    };
  }

  /** Resolves when no request is in flight, or after the plan's request drain, whichever comes first. */
  async waitForRequests(): Promise<void> {
    if (this.active === 0) return;
    const idle = await this.idleWithin(this.plan.requestDrainMs);
    if (!idle) {
      this.logger.warn(
        `Request drain ended after ${String(this.plan.requestDrainMs)} ms with ${String(this.active)} request(s) in flight`,
        LOGGER_CONTEXT,
      );
    }
  }

  private idleWithin(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const onIdle = (): void => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.idleWaiters.delete(onIdle);
        resolve(false);
      }, timeoutMs);
      this.idleWaiters.add(onIdle);
    });
  }

  private wakeIdleWaiters(): void {
    const waiters = [...this.idleWaiters];
    this.idleWaiters.clear();
    waiters.forEach((wake) => {
      wake();
    });
  }
}
