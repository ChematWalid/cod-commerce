import { ageSeconds } from './age';
import type { QueueJobState } from './constants';

/** One job as the queue gauges see it: its Vendure queue (the BullMQ job name), state and enqueue time. */
export interface QueuedJob {
  readonly name: string;
  readonly state: QueueJobState;
  readonly enqueuedAtMs: number;
}

/** What one pool's BullMQ queue holds: exact counts per state, and a bounded sample of its jobs. */
export interface QueueSnapshot {
  readonly counts: Readonly<Record<QueueJobState, number>>;
  readonly jobs: readonly QueuedJob[];
}

/** The number of jobs of one queue (job name) in one state. */
export interface QueueJobCount {
  readonly queue: string;
  readonly state: QueueJobState;
  readonly count: number;
}

/** How long the oldest waiting job of one queue has waited. */
export interface QueueWaitingAge {
  readonly queue: string;
  readonly ageSeconds: number;
}

/** The per-name gauges of one pool. */
export interface QueueGauges {
  readonly counts: readonly QueueJobCount[];
  readonly oldestWaiting: readonly QueueWaitingAge[];
}

const keyOf = (job: QueuedJob): string => `${job.state}\u0000${job.name}`;

function countByNameAndState(jobs: readonly QueuedJob[]): QueueJobCount[] {
  const counts = new Map<string, QueueJobCount>();
  for (const job of jobs) {
    const previous = counts.get(keyOf(job));
    counts.set(keyOf(job), { queue: job.name, state: job.state, count: (previous?.count ?? 0) + 1 });
  }
  return [...counts.values()];
}

function oldestWaitingByName(jobs: readonly QueuedJob[], nowMs: number): QueueWaitingAge[] {
  const oldest = new Map<string, number>();
  for (const job of jobs) {
    if (job.state !== 'waiting') continue;
    oldest.set(job.name, Math.min(oldest.get(job.name) ?? job.enqueuedAtMs, job.enqueuedAtMs));
  }
  return [...oldest.entries()].map(([queue, enqueuedAtMs]) => ({ queue, ageSeconds: ageSeconds(nowMs, enqueuedAtMs) }));
}

/**
 * Splits a pool's jobs by job name: Vendure keeps every queue of a pool in one BullMQ queue, so per-queue gauges
 * are computed per job name (ADR 0015 "golden signals").
 */
export function queueGaugesOf(jobs: readonly QueuedJob[], nowMs: number): QueueGauges {
  return { counts: countByNameAndState(jobs), oldestWaiting: oldestWaitingByName(jobs, nowMs) };
}
