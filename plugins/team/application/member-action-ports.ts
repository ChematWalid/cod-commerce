import type { BusinessLockPort } from '../domain/ports/business-lock.port';
import type { BusinessOwnerPort } from '../domain/ports/business-owner.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { CommissionConfigRepositoryPort } from '../domain/ports/commission-config-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { InvitationRepositoryPort } from '../domain/ports/invitation-repository.port';
import type { MemberAccessPort } from '../domain/ports/member-access.port';
import type { MemberAccountPort } from '../domain/ports/member-account.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { SalaryPaidPublisherPort } from '../domain/ports/salary-paid-publisher.port';
import type { SalaryPaymentRepositoryPort } from '../domain/ports/salary-payment-repository.port';
import type { TeamActivityPort } from '../domain/ports/team-activity.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** What the member actions (edit, limit, receiving, deactivate, reactivate, remove, pay) read and write through. */
export interface MemberActionPorts {
  readonly members: MemberRepositoryPort;
  readonly invitations: Pick<InvitationRepositoryPort, 'latestOfMember'>;
  readonly commissions: Pick<CommissionConfigRepositoryPort, 'findById'>;
  readonly access: MemberAccessPort;
  readonly accounts: Pick<MemberAccountPort, 'softDelete'>;
  readonly owner: BusinessOwnerPort;
  readonly salaries: SalaryPaymentRepositoryPort;
  readonly salaryPaid: SalaryPaidPublisherPort;
  readonly lock: BusinessLockPort;
  readonly transaction: TransactionPort;
  readonly activity: TeamActivityPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}
