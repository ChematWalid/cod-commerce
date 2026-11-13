import type { TenantScope } from '@cod/shared';
import type { SalaryPayment } from '../salary-payment';
import type { OperationContext } from './operation-context';

/** Announces a booked salary payment once, for the ledger (P6.S4) to record. */
export interface SalaryPaidPublisherPort {
  /**
   * Announces `payment` to the member holding the administrator account `administratorId` in the transaction `ctx`
   * carries: the announcement commits with the payment or not at all (D222).
   */
  publish(ctx: OperationContext, scope: TenantScope, payment: SalaryPayment, administratorId: number): Promise<void>;
}
