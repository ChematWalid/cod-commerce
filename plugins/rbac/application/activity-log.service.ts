import type { OperationContext } from '../domain/ports/operation-context';
import { type ActivityEntryInput, normalizeEntry } from '../domain/activity';
import type { ActivityLogPort } from '../domain/ports/activity-log.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import { sanitizeDiff } from '../domain/sanitize-diff';

/** Records what happened in the caller's business. Other features reach it through `ActivityRecordEvent` (D66). */
export class ActivityLogService {
  constructor(
    private readonly log: ActivityLogPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Stores the entry in the transaction `ctx` carries, with its diff sanitized (D66).
   *
   * @throws {@link ActivityEntryInvalidError} when the action, entity type or entity id is empty or too long
   */
  async record(ctx: OperationContext, entry: ActivityEntryInput): Promise<void> {
    await this.log.append(ctx, {
      ...entry,
      ...normalizeEntry(entry),
      diff: sanitizeDiff(entry.diff),
      id: this.ids.next(),
      createdAt: this.clock.now(),
    });
  }
}
