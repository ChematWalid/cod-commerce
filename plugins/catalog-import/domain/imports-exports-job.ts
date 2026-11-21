/**
 * The data of one `imports-exports` job (D2212), a durable job (`jobId` is its BullMQ id, `cim-<id>`/`cex-<id>`).
 * `recordId` names the job row; `businessId` and `storeId` are a routing hint only: the worker takes the scope and
 * actor from the row and fails the job when they differ. A type literal, not an interface, so it fits the
 * reconciler's `Record<string, string | number>` job data.
 */
export type ImportsExportsJobData = {
  readonly jobId: string;
  readonly kind: string;
  readonly recordId: string;
  readonly businessId: string;
  readonly storeId: string;
};
