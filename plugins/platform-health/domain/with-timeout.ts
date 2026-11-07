import { DomainError } from '@cod/shared';

/** A probe did not settle within its budget. */
export class ProbeTimeoutError extends DomainError {
  readonly code = 'platform-health.probe-timeout';

  constructor(readonly timeoutMs: number) {
    super(`timed out after ${String(timeoutMs)} ms`);
  }
}

/**
 * Settles like `promise`, or rejects with {@link ProbeTimeoutError} once `ms` milliseconds have passed.
 * The timer is cleared either way, so a fast probe leaves nothing scheduled behind it.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ProbeTimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
