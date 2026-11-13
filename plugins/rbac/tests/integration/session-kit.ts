import { SESSION_FLUSH_SETTLE_MS } from '../../domain/constants';

/** Resolves after `ms` milliseconds. */
export const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits out the delayed repeat delete of every session flush started so far (D55), so a cache spy installed next
 * sees only the deletes of the step under test (#139).
 */
export const settleSessionFlushes = (): Promise<void> => settle(SESSION_FLUSH_SETTLE_MS);
