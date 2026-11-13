import type { DurableJobData } from '@cod/shared';

/** The payload of a job on `platform-maintenance` that re-wraps one business's data key. The id is `kek-{businessId}-{kid}`. */
export interface KekRewrapJobData extends DurableJobData {
  readonly businessId: string;
  /** When the scheduled task queued it; informational, the rewrap decides from the stored kid. */
  readonly enqueuedAt: string;
}
