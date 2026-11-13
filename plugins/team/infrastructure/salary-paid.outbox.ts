import { type OutboxEventInput, OutboxService } from '@cod/plugin-platform-outbox';
import { DOMAIN_EVENT_NAMES, type SalaryPaidPayload, type TenantScope } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SalaryPaidPublisherPort } from '../domain/ports/salary-paid-publisher.port';
import type { SalaryPayment } from '../domain/salary-payment';
import { requestScope } from './request-scope';

/** The part of the platform outbox this adapter writes through. */
export type SalaryPaidOutboxPort = Pick<OutboxService, 'add'>;

/** The `salary.paid` outbox event of one booked payment (D222). */
export function salaryPaidEvent(payment: SalaryPayment, administratorId: number): OutboxEventInput {
  const payload: SalaryPaidPayload = {
    memberId: payment.memberId,
    administratorId,
    amount: payment.amount,
    paymentId: payment.id,
    paidAt: payment.paidAt.toISOString(),
  };
  return { topic: DOMAIN_EVENT_NAMES.SalaryPaid, aggregateId: payment.id, payload };
}

/**
 * {@link SalaryPaidPublisherPort} on the transactional outbox (ADR 0016, D222): the event row is written in the
 * paying transaction, next to the `salary_payment` row, so both commit or neither does, and the relay hands it to
 * the ledger (P6.S4) after commit.
 */
@Injectable()
export class OutboxSalaryPaidPublisher implements SalaryPaidPublisherPort {
  constructor(@Inject(OutboxService) private readonly outbox: SalaryPaidOutboxPort) {}

  async publish(
    ctx: OperationContext,
    scope: TenantScope,
    payment: SalaryPayment,
    administratorId: number,
  ): Promise<void> {
    await this.outbox.add(requestScope(ctx, scope), salaryPaidEvent(payment, administratorId));
  }
}
