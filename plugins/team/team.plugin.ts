import { AuthPlugin } from '@cod/plugin-auth/invitations';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { RbacPlugin } from '@cod/plugin-rbac/member-access';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { InvitationActions, InvitationUseCases } from './api/invitation-actions';
import { InvitationsAdminController } from './api/invitations-admin.controller';
import { InvitationsAdminResolver } from './api/invitations-admin.resolver';
import { InvitationsController } from './api/invitations.controller';
import { MemberReadActions } from './api/member-read-actions';
import { MembersReadController } from './api/members-read.controller';
import { MembersReadResolver } from './api/members-read.resolver';
import { NoStoreMiddleware } from './api/no-store';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { TeamRequestActors } from './api/actor-of';
import { teamAdminApiSchema } from './api/schema';
import { TeamThrottle } from './api/team-throttle';
import { TeamTranslations } from './api/team-translations';
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
import { invitationProviders } from './infrastructure/invitation.providers';
import { MEMBER_READ_PROVIDERS } from './infrastructure/member-read.providers';
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

function requireOptions(): TeamPluginOptions {
  const { options } = TeamPlugin;
  if (options === undefined) {
    throw new Error('TeamPlugin is registered without options: use TeamPlugin.init({ dashboardUrl })');
  }
  return options;
}

/**
 * Team members, invitations, commission configs and salary payments of a business (P1.S4). Roles and store access
 * stay in rbac, accounts in tenancy and auth (D202 to D204); Team reaches them through its own ports.
 */
@VendurePlugin({
  // `RateLimitPlugin` serves the `@RateLimit` guard and the limiter; `AuthPlugin` the invitation account and email.
  imports: [PluginCommonModule, TenancyPlugin, RbacPlugin, AuthPlugin, RateLimitPlugin],
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
    ...invitationProviders(() => requireOptions().dashboardUrl),
    ...MEMBER_READ_PROVIDERS,
    InvitationUseCases,
    InvitationActions,
    MemberReadActions,
    TeamRequestActors,
    TeamThrottle,
    TeamTranslations,
  ],
  adminApiExtensions: { schema: teamAdminApiSchema, resolvers: [InvitationsAdminResolver, MembersReadResolver] },
  controllers: [InvitationsController, InvitationsAdminController, MembersReadController],
  // The `migrate` role runs the member converge after rbac's (D215).
  exports: [TeamConvergeService],
  compatibility: '^3.8.0',
})
export class TeamPlugin implements NestModule {
  static options: TeamPluginOptions | undefined;

  /** REST refusals are translated; the public invitation routes never cache nor leak their address (D205). */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RestI18nMiddleware)
      .forRoutes(InvitationsController, InvitationsAdminController, MembersReadController);
    consumer.apply(NoStoreMiddleware).forRoutes(InvitationsController);
  }

  /** Registers the plugin with its options. */
  static init(options: TeamPluginOptions): typeof TeamPlugin {
    TeamPlugin.options = options;
    return TeamPlugin;
  }
}
