import type { PlatformGaugeSources } from '../../application/ports';
import type { QueueSnapshot } from '../../domain/queue-gauges';

export const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
export const secondsAgo = (seconds: number): Date => new Date(NOW - seconds * 1000);

const EMPTY: QueueSnapshot = { counts: { waiting: 0, active: 0, failed: 0, delayed: 0 }, jobs: [] };

/** Sources with an empty outbox, no heartbeats and empty pools; each test overrides what it reads. */
export function fakeSources(overrides: Partial<PlatformGaugeSources> = {}): PlatformGaugeSources & {
  readonly errors: string[];
} {
  const errors: string[] = [];
  return {
    queues: { snapshotOf: () => Promise.resolve(EMPTY) },
    pools: ['critical', 'bulk'],
    outbox: { pendingSummary: () => Promise.resolve({ pending: 0, oldest: null }) },
    tasks: { lastSuccess: () => Promise.resolve(new Map()), scheduledTaskIds: () => [] },
    now: () => NOW,
    logger: { error: (message) => errors.push(message) },
    ...overrides,
    errors,
  };
}
