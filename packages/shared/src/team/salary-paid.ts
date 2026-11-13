/**
 * The payload of a `salary.paid` outbox event (D222): ids, whole DZD (ADR 0004) and an ISO 8601 UTC time, nothing
 * else. The business is the event's own and never travels in the payload; the ledger (P6.S4) reads the rest by id.
 */
export type SalaryPaidPayload = {
  readonly memberId: string;
  /** The paid member's administrator account. */
  readonly administratorId: number;
  readonly amount: number;
  readonly paymentId: string;
  readonly paidAt: string;
};
