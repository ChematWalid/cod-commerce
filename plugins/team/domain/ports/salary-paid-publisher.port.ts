import type { TenantScope } from '@cod/shared';
import type { SalaryPayment } from '../salary-payment';
import type { OperationContext } from './operation-context';

/** Announces a booked salary payment once, for the ledger (P6.S4) to record. */
export interface SalaryPaidPublisherPort {
  publish(ctx: OperationContext, scope: TenantScope, payment: SalaryPayment): Promise<void>;
}
