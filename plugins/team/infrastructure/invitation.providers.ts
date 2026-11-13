import type { Provider } from '@nestjs/common';
import { AcceptInvitationService } from '../application/accept-invitation.service';
import type { TeamInvitationPorts } from '../application/invitation-ports';
import { InviteMemberService } from '../application/invite-member.service';
import { PreviewInvitationService } from '../application/preview-invitation.service';
import { ResendInvitationService } from '../application/resend-invitation.service';
import { RevokeInvitationService } from '../application/revoke-invitation.service';
import {
  BUSINESS_LOCK,
  BUSINESS_NAMES,
  CLOCK,
  COMMISSION_CONFIG_REPOSITORY,
  ID_GENERATOR,
  INVITATION_LINK_BASE,
  INVITATION_LOOKUP,
  INVITATION_MAIL,
  INVITATION_PORTS,
  INVITATION_REPOSITORY,
  INVITATION_TOKEN,
  MEMBER_ACCESS,
  MEMBER_ACCOUNTS,
  MEMBER_REPOSITORY,
  TEAM_ACTIVITY,
  TRANSACTION,
} from '../application/tokens';
import { AuthInvitationMailAdapter } from './auth-invitation-mail.adapter';
import { InvitationTokenLookup } from './invitation-token-lookup';
import { PgBusinessLock } from './pg-business-lock.adapter';
import { RbacMemberAccessAdapter } from './rbac-member-access.adapter';
import { TeamActivityAdapter } from './team-activity.adapter';
import { TenancyBusinessNamesAdapter } from './tenancy-business-names.adapter';
import { TenancyMemberAccountAdapter } from './tenancy-member-account.adapter';

/** The order of {@link PORT_TOKENS}, which the factory below receives. */
type PortList = [
  TeamInvitationPorts['members'],
  TeamInvitationPorts['invitations'],
  TeamInvitationPorts['lookup'],
  TeamInvitationPorts['commissions'],
  TeamInvitationPorts['access'],
  TeamInvitationPorts['accounts'],
  TeamInvitationPorts['mail'],
  TeamInvitationPorts['names'],
  TeamInvitationPorts['tokens'],
  TeamInvitationPorts['lock'],
  TeamInvitationPorts['transaction'],
  TeamInvitationPorts['activity'],
  TeamInvitationPorts['ids'],
  TeamInvitationPorts['clock'],
];

const PORT_TOKENS = [
  MEMBER_REPOSITORY,
  INVITATION_REPOSITORY,
  INVITATION_LOOKUP,
  COMMISSION_CONFIG_REPOSITORY,
  MEMBER_ACCESS,
  MEMBER_ACCOUNTS,
  INVITATION_MAIL,
  BUSINESS_NAMES,
  INVITATION_TOKEN,
  BUSINESS_LOCK,
  TRANSACTION,
  TEAM_ACTIVITY,
  ID_GENERATOR,
  CLOCK,
];

const USE_CASES = [
  InviteMemberService,
  ResendInvitationService,
  RevokeInvitationService,
  PreviewInvitationService,
  AcceptInvitationService,
].map((useCase) => ({
  provide: useCase,
  useFactory: (ports: TeamInvitationPorts) => new useCase(ports),
  inject: [INVITATION_PORTS],
}));

/** Gathers the adapters into the one bundle every invitation use case takes. */
const PORTS_PROVIDER: Provider = {
  provide: INVITATION_PORTS,
  useFactory: (
    ...[
      members,
      invitations,
      lookup,
      commissions,
      access,
      accounts,
      mail,
      names,
      tokens,
      lock,
      transaction,
      activity,
      ids,
      clock,
    ]: PortList
  ): TeamInvitationPorts => ({
    members,
    invitations,
    lookup,
    commissions,
    access,
    accounts,
    mail,
    names,
    tokens,
    lock,
    transaction,
    activity,
    ids,
    clock,
  }),
  inject: PORT_TOKENS,
};

/** Wires the invitation use cases (brief step 2) to their adapters; `linkBase` is the dashboard URL (D205). */
export function invitationProviders(linkBase: () => string): Provider[] {
  return [
    { provide: INVITATION_LINK_BASE, useFactory: linkBase },
    { provide: MEMBER_ACCESS, useClass: RbacMemberAccessAdapter },
    { provide: MEMBER_ACCOUNTS, useClass: TenancyMemberAccountAdapter },
    { provide: INVITATION_MAIL, useClass: AuthInvitationMailAdapter },
    { provide: BUSINESS_NAMES, useClass: TenancyBusinessNamesAdapter },
    { provide: BUSINESS_LOCK, useClass: PgBusinessLock },
    { provide: INVITATION_LOOKUP, useClass: InvitationTokenLookup },
    { provide: TEAM_ACTIVITY, useClass: TeamActivityAdapter },
    PORTS_PROVIDER,
    ...USE_CASES,
  ];
}
