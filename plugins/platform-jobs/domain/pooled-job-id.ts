import { QUEUE_POOLS, type QueuePool } from '@cod/shared';
import { POOLED_JOB_ID_SEPARATOR } from './constants';

/** A job id that names its pool and the job's id inside that pool's BullMQ queue. */
export interface PooledJobId {
  readonly pool: QueuePool;
  readonly bullId: string;
}

const isPool = (value: string): value is QueuePool => (QUEUE_POOLS as readonly string[]).includes(value);

/** The id a job carries outside the strategy: `{pool}.{bullId}`, e.g. `critical.ob-7301`. */
export function toPooledJobId(pool: QueuePool, bullId: string): string {
  return `${pool}${POOLED_JOB_ID_SEPARATOR}${bullId}`;
}

/** Splits `{pool}.{bullId}` at its first dot; undefined when the id names no pool or no BullMQ id. */
export function parsePooledJobId(id: string | number): PooledJobId | undefined {
  if (typeof id !== 'string') return undefined;
  const separator = id.indexOf(POOLED_JOB_ID_SEPARATOR);
  if (separator < 0) return undefined;
  const pool = id.slice(0, separator);
  const bullId = id.slice(separator + POOLED_JOB_ID_SEPARATOR.length);
  if (!isPool(pool) || bullId === '') return undefined;
  return { pool, bullId };
}
