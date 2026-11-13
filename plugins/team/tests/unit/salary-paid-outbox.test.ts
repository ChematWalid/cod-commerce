import type { OutboxEventInput, OutboxEventRef } from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import { DOMAIN_EVENT_NAMES, type TenantScope, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { OutboxSalaryPaidPublisher, type SalaryPaidOutboxPort } from '../../infrastructure/salary-paid.outbox';
import { salaryPayment, scopeA, T0 } from '../support/builders';

const MEMBER = toSnowflake('3001');
const PAID_ADMINISTRATOR = 30;

/** The outbox as the adapter sees it: it records what was added, under which scope. */
class RecordingOutbox implements SalaryPaidOutboxPort {
  readonly added: { scope: TenantScope; input: OutboxEventInput }[] = [];

  add(scope: TenantScope, input: OutboxEventInput): Promise<OutboxEventRef> {
    this.added.push({ scope, input });
    return Promise.resolve({ id: '1', createdAt: T0.toISOString() });
  }
}

describe('OutboxSalaryPaidPublisher', () => {
  it('adds one salary.paid event in the transaction the paying context carries', async () => {
    // Arrange
    const outbox = new RecordingOutbox();
    // Stands for the transactional request context `TenantTransaction.run` hands the pay use case.
    const transactional = {};
    const payment = salaryPayment(scopeA, MEMBER, { amount: 41_000 });

    // Act
    await new OutboxSalaryPaidPublisher(outbox).publish(
      asOperationContext(transactional),
      scopeA,
      payment,
      PAID_ADMINISTRATOR,
    );

    // Assert
    expect(outbox.added).toHaveLength(1);
    const [added] = outbox.added;
    expect(requestContextOf(added?.scope ?? scopeA)).toBe(transactional);
    expect(added?.scope.businessId).toBe(scopeA.businessId);
    expect(added?.input).toEqual({
      topic: DOMAIN_EVENT_NAMES.SalaryPaid,
      aggregateId: payment.id,
      payload: {
        memberId: MEMBER,
        administratorId: PAID_ADMINISTRATOR,
        amount: 41_000,
        paymentId: payment.id,
        paidAt: T0.toISOString(),
      },
    });
  });

  it('never carries the business, the idempotency key or the payer in the payload', async () => {
    // Arrange
    const outbox = new RecordingOutbox();
    const payment = salaryPayment(scopeA, MEMBER);

    // Act
    await new OutboxSalaryPaidPublisher(outbox).publish(asOperationContext({}), scopeA, payment, PAID_ADMINISTRATOR);

    // Assert
    const keys = Object.keys(outbox.added[0]?.input.payload ?? {});
    expect(keys.sort()).toEqual(['administratorId', 'amount', 'memberId', 'paidAt', 'paymentId']);
  });
});
