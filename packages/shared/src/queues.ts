import { DomainError } from './errors/domain-error';

/** Worker pools of ADR 0013: critical queues are kept apart from bulk and LLM work. */
export const QUEUE_POOLS = ['critical', 'bulk'] as const;
export type QueuePool = (typeof QUEUE_POOLS)[number];

/** `WORKER_POOL` values; `all` runs every queue in one process (the Launch layout). */
export const WORKER_POOLS = ['critical', 'bulk', 'all'] as const;
export type WorkerPool = (typeof WORKER_POOLS)[number];

/** Retry and fairness settings of one queue. "Attempts" is the total number of tries (ADR 0013 "retries"). */
export interface QueueSpec {
  readonly pool: QueuePool;
  readonly concurrency: number;
  readonly attempts: number;
  readonly backoff: { readonly type: 'exponential' | 'fixed'; readonly delayMs: number };
}

const exponential = (pool: QueuePool, concurrency: number, attempts: number, delayMs: number): QueueSpec => ({
  pool,
  concurrency,
  attempts,
  backoff: { type: 'exponential', delayMs },
});

// Stock Vendure queues run once; their own code decides about retrying.
const STOCK: QueueSpec = {
  pool: 'critical',
  concurrency: 3,
  attempts: 1,
  backoff: { type: 'fixed', delayMs: 0 },
};

// ADR 0013 "12 over 24 h": BullMQ waits between attempts, so 12 attempts mean 11 waits; 42 s doubled
// 11 times sums to about 23.9 h.
const DAY_LONG_RETRY = exponential('bulk', 10, 12, 42_000);

/** Every queue the platform runs, with its pool, concurrency per worker and retry policy. */
export const QUEUES = {
  'inbound-webhooks': exponential('critical', 10, 10, 2_000),
  'outbox-relay': exponential('critical', 10, 8, 1_000),
  'order-effects': exponential('critical', 10, 8, 1_000),
  dispatch: exponential('critical', 5, 5, 5_000),
  notifications: exponential('critical', 10, 6, 10_000),
  'storefront-revalidate': exponential('critical', 5, 5, 1_000),
  domains: exponential('critical', 3, 5, 60_000),
  'auth-email': exponential('critical', 5, 5, 30_000),
  'apply-collection-filters': STOCK,
  'clean-sessions': STOCK,
  'update-search-index': STOCK,
  capi: DAY_LONG_RETRY,
  'outbound-webhooks': DAY_LONG_RETRY,
  integrations: exponential('bulk', 5, 8, 30_000),
  'carrier-polling': exponential('bulk', 5, 3, 10_000),
  analytics: exponential('bulk', 2, 3, 10_000),
  ai: exponential('bulk', 3, 3, 10_000),
  'imports-exports': exponential('bulk', 2, 2, 30_000),
  'asset-derivatives': exponential('bulk', 1, 3, 10_000),
  documents: exponential('bulk', 1, 3, 10_000),
  'platform-maintenance': exponential('bulk', 1, 3, 10_000),
} as const satisfies Record<string, QueueSpec>;

export type QueueName = keyof typeof QUEUES;

/** Queues created by Vendure itself; they join the critical pool. */
export const STOCK_VENDURE_QUEUES: readonly QueueName[] = [
  'apply-collection-filters',
  'clean-sessions',
  'update-search-index',
];

const QUEUE_NAMES = new Set<string>(Object.keys(QUEUES));

/** Narrows a string to a registered queue name. */
export function isQueueName(name: string): name is QueueName {
  return QUEUE_NAMES.has(name);
}

/**
 * Queue names a worker of `pool` starts. `all` returns `[]`, which Vendure reads as "every queue".
 */
export function activeQueuesFor(pool: WorkerPool): readonly QueueName[] {
  if (pool === 'all') return [];
  return (Object.keys(QUEUES) as QueueName[]).filter((name) => QUEUES[name].pool === pool);
}

/** Prefixes of durable job ids; BullMQ refuses ids that are integers or contain `:`. */
export const DURABLE_JOB_KINDS = {
  outboxRelay: 'ob',
  outboxDelivery: 'od',
  inboundWebhook: 'iw',
  kekRewrap: 'kek',
} as const;
export type DurableJobKind = (typeof DURABLE_JOB_KINDS)[keyof typeof DURABLE_JOB_KINDS];

/** The ending a continuation job id has (`{jobId}-r{n}`, D100); no durable id may end like it. */
const CONTINUATION_LIKE_SUFFIX = /-r\d+$/;

/** Job data every durable queue carries: the id BullMQ must use, and an optional start delay. */
export interface DurableJobData {
  readonly jobId: string;
  readonly delayMs?: number;
}

/** Thrown when a durable job id part is empty or contains `:`. */
export class InvalidDurableJobIdError extends DomainError {
  readonly code = 'queues.invalid-durable-job-id';

  constructor(kind: string) {
    super(`Invalid durable job id part for kind "${kind}"`);
  }
}

/**
 * Builds a durable job id such as `od-7301-demo-log`.
 *
 * @throws {@link InvalidDurableJobIdError} when there is no part, a part is empty or contains `:`, the first part contains `-`,
 * or the id ends in `-r<digits>`: that suffix names a re-queued continuation (`ob-7-r2`), so `od-7-foo-r1` could collide with one.
 */
export function durableJobId(kind: DurableJobKind, ...parts: readonly string[]): string {
  // '-' joins the parts, so a dash in the first part would make two different id tuples collide.
  if (parts.length === 0 || parts[0]?.includes('-') || parts.some((part) => part === '' || part.includes(':'))) {
    throw new InvalidDurableJobIdError(kind);
  }
  const id = [kind, ...parts].join('-');
  if (CONTINUATION_LIKE_SUFFIX.test(id)) throw new InvalidDurableJobIdError(kind);
  return id;
}
