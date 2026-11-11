import { type OutboxPayload, type TenantScope, validateOutboxPayload } from '@cod/shared';
import { OUTBOX_DEDUPE_KEY_MAX_LENGTH, OUTBOX_ID_FORMAT } from '../domain/constants';
import { OutboxInputInvalidError } from '../domain/errors';
import type { OutboxEventInput, OutboxEventRef } from '../domain/outbox-event';
import type { OutboxAnnouncerPort, OutboxClock, OutboxIdSource, OutboxStorePort } from './ports';

function checkId(field: string, value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!OUTBOX_ID_FORMAT.test(value)) throw new OutboxInputInvalidError(`${field} is not an id`);
  return value;
}

function checkDedupeKey(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value.length === 0 || value.length > OUTBOX_DEDUPE_KEY_MAX_LENGTH) {
    throw new OutboxInputInvalidError(`dedupeKey must be 1 to ${String(OUTBOX_DEDUPE_KEY_MAX_LENGTH)} characters`);
  }
  return value;
}

/**
 * The write side of the outbox (D104): inserts the event in the caller's transaction and announces it, so that after
 * commit the relay is started. A rollback takes the row and the announcement with it.
 */
export class OutboxService {
  constructor(
    private readonly store: OutboxStorePort,
    private readonly announcer: OutboxAnnouncerPort,
    private readonly ids: OutboxIdSource,
    private readonly clock: OutboxClock,
  ) {}

  /**
   * Writes one event for the scope's business. The business is never read from the payload.
   * @throws OutboxTransactionRequiredError outside a transaction, OutboxPayloadRejectedError for a payload the
   * outbox refuses and OutboxInputInvalidError for a malformed id or key.
   */
  async add(scope: TenantScope, input: OutboxEventInput): Promise<OutboxEventRef> {
    const payload: OutboxPayload = validateOutboxPayload(input.payload);
    const storeId = checkId('storeId', input.storeId);
    const aggregateId = checkId('aggregateId', input.aggregateId);
    const dedupeKey = checkDedupeKey(input.dedupeKey);
    const createdAt = new Date(this.clock.now());
    const id = this.ids.next();
    await this.store.insertEvent(scope, {
      id,
      createdAt,
      storeId,
      topic: input.topic,
      aggregateId,
      payload,
      dedupeKey,
    });
    const ref: OutboxEventRef = { id, createdAt: createdAt.toISOString() };
    await this.announcer.announce(scope, [ref]);
    return ref;
  }
}
