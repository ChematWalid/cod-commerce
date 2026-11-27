/** One storefront revalidation to run on the `storefront-revalidate` queue. */
export interface RevalidationJob {
  /** Unique per cause (an outbox id, a rebuild job id): a repeat of the same cause is one job. */
  readonly key: string;
  readonly storeId: string;
  readonly tags: readonly string[];
  /** Waits this long before running. */
  readonly delayMs?: number;
}

/** Queues storefront revalidations, so no outbox delivery or rebuild waits on the storefront. */
export interface RevalidationQueuePort {
  enqueue(job: RevalidationJob): Promise<void>;
}
