import { KEY_PURGE_BATCH_SIZE, KEY_PURGE_BUDGET_MS, KEY_RETENTION_MS } from '../domain/constants';
import type { InboundClock, KeyPurgePort } from './ports';

/** Deletes the dedupe keys older than 30 days (D107): batches of 5 000 within a 40 s budget. */
export class InboundKeyPurge {
  constructor(
    private readonly store: KeyPurgePort,
    private readonly clock: InboundClock,
  ) {}

  /** One catch-up run as of `now`; what the budget leaves is taken by the next run. */
  async purge(now: Date): Promise<{ deleted: number }> {
    const cutoff = new Date(now.getTime() - KEY_RETENTION_MS);
    const deadline = this.clock.now() + KEY_PURGE_BUDGET_MS;
    let deleted = 0;
    while (this.clock.now() < deadline) {
      const batch = await this.store.deleteKeysBefore(cutoff, KEY_PURGE_BATCH_SIZE);
      deleted += batch;
      if (batch < KEY_PURGE_BATCH_SIZE) break;
    }
    return { deleted };
  }
}
