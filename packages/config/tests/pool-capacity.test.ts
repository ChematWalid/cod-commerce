import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { QUEUE_POOLS, QUEUES } from '../../shared/src/queues';

const repoRoot = resolve(__dirname, '../../..');

/** An export reads this many products at once outside a transaction (#270 item 10, D2282). */
const EXPORT_READ_BURST = 25;
/** The scheduler's tasks and the readiness probe, beside the jobs. */
const HOUSEKEEPING_CONNECTIONS = 2;

interface ComposeFile {
  readonly services: Record<string, { readonly environment?: Record<string, string> }>;
}

/**
 * Vendure's BullMQ strategy runs one BullMQ worker per distinct concurrency value of a pool, and every queue with
 * that value shares it: a pool runs at most the sum of its distinct concurrencies at once.
 */
const poolConcurrency = (pool: (typeof QUEUE_POOLS)[number]): number =>
  [
    ...new Set(
      Object.values(QUEUES)
        .filter((spec) => spec.pool === pool)
        .map((spec) => spec.concurrency),
    ),
  ].reduce((sum, value) => sum + value, 0);

const defaultOf = (value: string | undefined): number => Number(/:-(\d+)\}$/.exec(value ?? '')?.[1]);

describe('worker pool sizing (#270 items 10 and 12, docs/ops/capacity.md)', () => {
  it('gives the compose worker one connection per job it can run at once, plus the export burst', () => {
    // Arrange
    const compose = parse(readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8'), { merge: true }) as ComposeFile;
    const jobs = QUEUE_POOLS.reduce((sum, pool) => sum + poolConcurrency(pool), 0);

    // Act
    const workerPool = defaultOf(compose.services['worker']?.environment?.['DB_POOL_MAX']);

    // Assert
    expect(workerPool).toBeGreaterThanOrEqual(jobs + EXPORT_READ_BURST + HOUSEKEEPING_CONNECTIONS);
  });

  it('documents the numbers it checks', () => {
    // Arrange
    const capacity = readFileSync(join(repoRoot, 'docs/ops/capacity.md'), 'utf8');

    // Assert
    for (const pool of QUEUE_POOLS) expect(capacity).toContain(`| ${pool} | ${String(poolConcurrency(pool))} |`);
  });
});
