import { RbacPlugin } from '@cod/plugin-rbac/member-access';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { TeamConvergeService } from './application/converge-members.service';
import {
  COMMISSION_CONFIG_REPOSITORY,
  ID_GENERATOR,
  INVITATION_REPOSITORY,
  INVITATION_TOKEN,
  MEMBER_REPOSITORY,
  SALARY_PAYMENT_REPOSITORY,
  TRANSACTION,
} from './application/tokens';
import { CommissionConfigEntity } from './infrastructure/commission-config.entity';
import { CONVERGE_PROVIDERS } from './infrastructure/converge.providers';
import { InvitationEntity } from './infrastructure/invitation.entity';
import { SalaryPaymentEntity } from './infrastructure/salary-payment.entity';
import { Sha256InvitationToken } from './infrastructure/sha256-token';
import { SnowflakeTeamIdGenerator } from './infrastructure/snowflake-id.generator';
import { TeamMemberEntity } from './infrastructure/team-member.entity';
import { TransactionAdapter } from './infrastructure/transaction.adapter';
import { TypeOrmCommissionConfigRepository } from './infrastructure/typeorm-commission-config.repository';
import { TypeOrmInvitationRepository } from './infrastructure/typeorm-invitation.repository';
import { TypeOrmMemberRepository } from './infrastructure/typeorm-member.repository';
import { TypeOrmSalaryPaymentRepository } from './infrastructure/typeorm-salary-payment.repository';

/** What the host passes to {@link TeamPlugin.init}. */
export interface TeamPluginOptions {
  /** The merchant dashboard's base URL; invitation links point at its `/accept-invitation` page (D205). */
  readonly dashboardUrl: string;
}

/**
 * Team members, invitations, commission configs and salary payments of a business (P1.S4). Roles and store access
 * stay in rbac, accounts in tenancy and auth (D202 to D204); Team reaches them through its own ports.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, RbacPlugin],
  entities: [TeamMemberEntity, InvitationEntity, CommissionConfigEntity, SalaryPaymentEntity],
  providers: [
    { provide: MEMBER_REPOSITORY, useClass: TypeOrmMemberRepository },
    { provide: INVITATION_REPOSITORY, useClass: TypeOrmInvitationRepository },
    { provide: COMMISSION_CONFIG_REPOSITORY, useClass: TypeOrmCommissionConfigRepository },
    { provide: SALARY_PAYMENT_REPOSITORY, useClass: TypeOrmSalaryPaymentRepository },
    { provide: INVITATION_TOKEN, useClass: Sha256InvitationToken },
    { provide: TRANSACTION, useClass: TransactionAdapter },
    {
      provide: ID_GENERATOR,
      useFactory: (ids: SnowflakeIdGeneratorPort) => new SnowflakeTeamIdGenerator(ids),
      inject: [SNOWFLAKE_ID_GENERATOR],
    },
    ...CONVERGE_PROVIDERS,
  ],
  // The `migrate` role runs the member converge after rbac's (D215).
  exports: [TeamConvergeService],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TeamPlugin {
  static options: TeamPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: TeamPluginOptions): typeof TeamPlugin {
    TeamPlugin.options = options;
    return TeamPlugin;
  }
}
