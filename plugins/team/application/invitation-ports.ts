import type { BusinessLockPort } from '../domain/ports/business-lock.port';
import type { BusinessNamesPort } from '../domain/ports/business-names.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { CommissionConfigRepositoryPort } from '../domain/ports/commission-config-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { InvitationLookupPort } from '../domain/ports/invitation-lookup.port';
import type { InvitationMailPort } from '../domain/ports/invitation-mail.port';
import type { InvitationRepositoryPort } from '../domain/ports/invitation-repository.port';
import type { InvitationTokenPort } from '../domain/ports/invitation-token.port';
import type { MemberAccessPort } from '../domain/ports/member-access.port';
import type { MemberAccountPort } from '../domain/ports/member-account.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { TeamActivityPort } from '../domain/ports/team-activity.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** What the invitation use cases (invite, resend, revoke, preview, accept) read and write through. */
export interface TeamInvitationPorts {
  readonly members: MemberRepositoryPort;
  readonly invitations: InvitationRepositoryPort;
  readonly lookup: InvitationLookupPort;
  readonly commissions: Pick<CommissionConfigRepositoryPort, 'findById'>;
  readonly access: MemberAccessPort;
  readonly accounts: MemberAccountPort;
  readonly mail: InvitationMailPort;
  readonly names: BusinessNamesPort;
  readonly tokens: InvitationTokenPort;
  readonly lock: BusinessLockPort;
  readonly transaction: TransactionPort;
  readonly activity: TeamActivityPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}
