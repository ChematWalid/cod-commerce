import type { Provider } from '@nestjs/common';
import { ListOrderManagersService } from '../application/list-order-managers.service';
import type { MemberActionPorts } from '../application/member-action-ports';
import { MemberLifecycleService } from '../application/member-lifecycle.service';
import type { MemberReadPorts } from '../application/member-read-ports';
import { PaySalaryService } from '../application/pay-salary.service';
import { RemoveMemberService } from '../application/remove-member.service';
import { RevokeInvitationService } from '../application/revoke-invitation.service';
import {
  BUSINESS_LOCK,
  BUSINESS_OWNER,
  CLOCK,
  COMMISSION_CONFIG_REPOSITORY,
  ID_GENERATOR,
  INVITATION_REPOSITORY,
  MEMBER_ACCESS,
  MEMBER_ACCOUNTS,
  MEMBER_ACTION_PORTS,
  MEMBER_READ_PORTS,
  MEMBER_REPOSITORY,
  SALARY_PAID_PUBLISHER,
  SALARY_PAYMENT_REPOSITORY,
  TEAM_ACTIVITY,
  TRANSACTION,
} from '../application/tokens';
import { UpdateMemberService } from '../application/update-member.service';
import { EventBusSalaryPaidPublisher } from './salary-paid.event';
import { TenancyBusinessNamesAdapter } from './tenancy-business-names.adapter';

/** The order of {@link PORT_TOKENS}, which the factory below receives. */
type PortList = [
  MemberActionPorts['members'],
  MemberActionPorts['invitations'],
  MemberActionPorts['commissions'],
  MemberActionPorts['access'],
  MemberActionPorts['accounts'],
  MemberActionPorts['owner'],
  MemberActionPorts['salaries'],
  MemberActionPorts['salaryPaid'],
  MemberActionPorts['lock'],
  MemberActionPorts['transaction'],
  MemberActionPorts['activity'],
  MemberActionPorts['ids'],
  MemberActionPorts['clock'],
];

const PORT_TOKENS = [
  MEMBER_REPOSITORY,
  INVITATION_REPOSITORY,
  COMMISSION_CONFIG_REPOSITORY,
  MEMBER_ACCESS,
  MEMBER_ACCOUNTS,
  BUSINESS_OWNER,
  SALARY_PAYMENT_REPOSITORY,
  SALARY_PAID_PUBLISHER,
  BUSINESS_LOCK,
  TRANSACTION,
  TEAM_ACTIVITY,
  ID_GENERATOR,
  CLOCK,
];

/** Gathers the adapters into the one bundle every member action takes. */
const PORTS_PROVIDER: Provider = {
  provide: MEMBER_ACTION_PORTS,
  useFactory: (
    ...[
      members,
      invitations,
      commissions,
      access,
      accounts,
      owner,
      salaries,
      salaryPaid,
      lock,
      transaction,
      activity,
      ids,
      clock,
    ]: PortList
  ): MemberActionPorts => ({
    members,
    invitations,
    commissions,
    access,
    accounts,
    owner,
    salaries,
    salaryPaid,
    lock,
    transaction,
    activity,
    ids,
    clock,
  }),
  inject: PORT_TOKENS,
};

const USE_CASES: Provider[] = [UpdateMemberService, MemberLifecycleService, PaySalaryService].map((useCase) => ({
  provide: useCase,
  useFactory: (ports: MemberActionPorts) => new useCase(ports),
  inject: [MEMBER_ACTION_PORTS],
}));

/**
 * Wires the member actions (brief step 4) to their adapters. rbac access, accounts, the lock, the activity log and the
 * clock come from the invitation wiring; the business owner from tenancy's business reader.
 */
export const MEMBER_ACTION_PROVIDERS: Provider[] = [
  { provide: BUSINESS_OWNER, useClass: TenancyBusinessNamesAdapter },
  { provide: SALARY_PAID_PUBLISHER, useClass: EventBusSalaryPaidPublisher },
  PORTS_PROVIDER,
  ...USE_CASES,
  {
    provide: RemoveMemberService,
    useFactory: (ports: MemberActionPorts, revoker: RevokeInvitationService) => new RemoveMemberService(ports, revoker),
    inject: [MEMBER_ACTION_PORTS, RevokeInvitationService],
  },
  {
    provide: ListOrderManagersService,
    useFactory: (ports: MemberReadPorts) => new ListOrderManagersService(ports),
    inject: [MEMBER_READ_PORTS],
  },
];
