import type { BusinessLockPort } from '../domain/ports/business-lock.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { CommissionConfigRepositoryPort } from '../domain/ports/commission-config-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberDirectoryPort } from '../domain/ports/member-directory.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { TeamActivityPort } from '../domain/ports/team-activity.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** What the commission configs (brief step 5) read and write through. */
export interface CommissionConfigPorts {
  readonly commissions: CommissionConfigRepositoryPort;
  /** Who is given a commission: deleting one in use, or editing one's own, is refused. */
  readonly members: Pick<MemberRepositoryPort, 'listLive'>;
  /** The stores of the business, so a commission never names another business's store. */
  readonly stores: Pick<MemberDirectoryPort, 'storeNames'>;
  readonly lock: BusinessLockPort;
  readonly transaction: TransactionPort;
  readonly activity: TeamActivityPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}
