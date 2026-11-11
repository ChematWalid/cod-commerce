import { DomainError } from '@cod/shared';

/** A probe did not settle within its budget. */
export class ProbeTimeoutError extends DomainError {
  readonly code = 'platform-health.probe-timeout';

  constructor(readonly timeoutMs: number) {
    super(`timed out after ${String(timeoutMs)} ms`);
  }
}

/**
 * Settles like `run(signal)`, or rejects with {@link ProbeTimeoutError} once `ms` milliseconds have passed.
 * On a timeout the signal is aborted, so the work can stop instead of running on behind the verdict.
 * The timer is cleared either way, so a fast probe leaves nothing scheduled behind it.
 */
export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new ProbeTimeoutError(ms);
      controller.abort(error);
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
