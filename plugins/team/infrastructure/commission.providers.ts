import type { Provider } from '@nestjs/common';
import type { CommissionConfigPorts } from '../application/commission-config-ports';
import { CommissionConfigService } from '../application/commission-config.service';
import {
  BUSINESS_LOCK,
  CLOCK,
  COMMISSION_CONFIG_REPOSITORY,
  COMMISSION_PORTS,
  ID_GENERATOR,
  MEMBER_DIRECTORY,
  MEMBER_REPOSITORY,
  TEAM_ACTIVITY,
  TRANSACTION,
} from '../application/tokens';

/** The order of the injected adapters, which the factory below receives. */
type PortList = [
  CommissionConfigPorts['commissions'],
  CommissionConfigPorts['members'],
  CommissionConfigPorts['stores'],
  CommissionConfigPorts['lock'],
  CommissionConfigPorts['transaction'],
  CommissionConfigPorts['activity'],
  CommissionConfigPorts['ids'],
  CommissionConfigPorts['clock'],
];

/**
 * Wires the commission configs (brief step 5) to their adapters. The store names come from the member read wiring;
 * the lock, the activity log and the clock from the invitation wiring.
 */
export const COMMISSION_PROVIDERS: Provider[] = [
  {
    provide: COMMISSION_PORTS,
    useFactory: (
      ...[commissions, members, stores, lock, transaction, activity, ids, clock]: PortList
    ): CommissionConfigPorts => ({ commissions, members, stores, lock, transaction, activity, ids, clock }),
    inject: [
      COMMISSION_CONFIG_REPOSITORY,
      MEMBER_REPOSITORY,
      MEMBER_DIRECTORY,
      BUSINESS_LOCK,
      TRANSACTION,
      TEAM_ACTIVITY,
      ID_GENERATOR,
      CLOCK,
    ],
  },
  {
    provide: CommissionConfigService,
    useFactory: (ports: CommissionConfigPorts) => new CommissionConfigService(ports),
    inject: [COMMISSION_PORTS],
  },
];
