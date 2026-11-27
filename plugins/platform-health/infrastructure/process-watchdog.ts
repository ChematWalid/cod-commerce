import { LOGGER_CONTEXT, SHUTDOWN_DEADLINE_EXIT_CODE } from '../domain/constants';
import type { ShutdownWatchdog } from '../domain/ports';

/** The logger the watchdog reports a missed deadline to. */
export interface WatchdogLogger {
  error(message: string, context?: string): void;
}

/**
 * Ends the process when its shutdown outlives the deadline, so a stuck queue or pool close exits with our code
 * and a log line before the orchestrator's SIGKILL. The timer is unref'd: it never keeps a finished process up.
 */
export class ProcessShutdownWatchdog implements ShutdownWatchdog {
  constructor(
    private readonly exit: (code: number) => void,
    private readonly logger: WatchdogLogger,
  ) {}

  arm(deadlineMs: number): void {
    const timer = setTimeout(() => {
      this.logger.error(`Shutdown still running after ${String(deadlineMs)} ms: exiting`, LOGGER_CONTEXT);
      this.exit(SHUTDOWN_DEADLINE_EXIT_CODE);
    }, deadlineMs);
    timer.unref();
  }
}
