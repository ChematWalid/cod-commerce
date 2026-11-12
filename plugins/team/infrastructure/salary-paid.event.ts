import { type BusinessId, DOMAIN_EVENT_NAMES, type Snowflake, type TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { EventBus, type RequestContext, VendureEvent } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SalaryPaidPublisherPort } from '../domain/ports/salary-paid-publisher.port';
import type { SalaryPayment } from '../domain/salary-payment';
import { toRequestContext } from './request-scope';

/** What a `salary.paid` event tells its subscribers: whole DZD (ADR 0004), never a finance row. */
export interface SalaryPaidPayload {
  readonly businessId: BusinessId;
  readonly memberId: Snowflake;
  /** The paid member's administrator account. */
  readonly administratorId: number;
  readonly amount: number;
  readonly paymentId: Snowflake;
  readonly paidAt: Date;
}

/**
 * `salary.paid` (`DOMAIN_EVENT_NAMES.SalaryPaid`): one booked salary payment, for the ledger (P6.S4) to record. It
 * carries the paying request's transactional context, so Vendure hands it to subscribers only after that transaction
 * commits, and never when it rolls back.
 */
export class SalaryPaidEvent extends VendureEvent {
  readonly name = DOMAIN_EVENT_NAMES.SalaryPaid;

  constructor(
    readonly ctx: RequestContext,
    readonly payload: SalaryPaidPayload,
  ) {
    super();
  }
}

/** {@link SalaryPaidPublisherPort} on Vendure's event bus. */
@Injectable()
export class EventBusSalaryPaidPublisher implements SalaryPaidPublisherPort {
  constructor(private readonly events: EventBus) {}

  async publish(
    ctx: OperationContext,
    scope: TenantScope,
    payment: SalaryPayment,
    administratorId: number,
  ): Promise<void> {
    await this.events.publish(
      new SalaryPaidEvent(toRequestContext(ctx), {
        businessId: scope.businessId,
        memberId: payment.memberId,
        administratorId,
        amount: payment.amount,
        paymentId: payment.id,
        paidAt: payment.paidAt,
      }),
    );
  }
}
