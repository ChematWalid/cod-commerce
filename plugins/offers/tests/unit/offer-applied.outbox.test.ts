import type { OutboxEventInput, OutboxEventRef } from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import { DOMAIN_EVENT_NAMES, type OfferAppliedPayload, type TenantScope, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { OutboxOfferEvents, type OfferAppliedOutboxPort } from '../../infrastructure/offer-applied.outbox';
import { T0 } from '../support/builders';
import { scopeA } from '../support/offer-records';

/** The outbox as the adapter sees it: it records what was added, under which scope. */
class RecordingOutbox implements OfferAppliedOutboxPort {
  readonly added: { scope: TenantScope; input: OutboxEventInput }[] = [];

  add(scope: TenantScope, input: OutboxEventInput): Promise<OutboxEventRef> {
    this.added.push({ scope, input });
    return Promise.resolve({ id: '1', createdAt: T0.toISOString() });
  }
}

const PAYLOAD: OfferAppliedPayload = {
  offerId: toSnowflake('1300000000000000001'),
  kind: 'addon',
  orderId: toSnowflake('1400000000000000001'),
  storeId: scopeA.storeId,
  amount: 3_000,
  source: 'post_order_addon',
};

describe('OutboxOfferEvents', () => {
  it('writes offer.applied to the outbox in the order transaction', async () => {
    // Arrange
    const outbox = new RecordingOutbox();
    // Stands for the transactional request context the order's caller hands the add-on use case.
    const transactional = {};

    // Act
    await new OutboxOfferEvents(outbox).offerApplied(asOperationContext(transactional), scopeA, PAYLOAD);

    // Assert
    expect(outbox.added).toHaveLength(1);
    const [added] = outbox.added;
    expect(requestContextOf(added?.scope ?? scopeA)).toBe(transactional);
    expect(added?.scope.businessId).toBe(scopeA.businessId);
    expect(added?.input).toEqual({
      topic: DOMAIN_EVENT_NAMES.OfferApplied,
      aggregateId: PAYLOAD.offerId,
      storeId: scopeA.storeId,
      payload: PAYLOAD,
    });
  });
});
