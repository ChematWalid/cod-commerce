import { AuthPlugin } from '@cod/plugin-auth';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TenancyPlugin, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  withPartitionedSchemas,
} from '@cod/testing';
import { type RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { CommissionConfigEntity } from '../../infrastructure/commission-config.entity';
import { InvitationEntity } from '../../infrastructure/invitation.entity';
import { SalaryPaymentEntity } from '../../infrastructure/salary-payment.entity';
import { TeamMemberEntity } from '../../infrastructure/team-member.entity';
import { TypeOrmCommissionConfigRepository } from '../../infrastructure/typeorm-commission-config.repository';
import { TypeOrmInvitationRepository } from '../../infrastructure/typeorm-invitation.repository';
import { TypeOrmMemberRepository } from '../../infrastructure/typeorm-member.repository';
import { TypeOrmSalaryPaymentRepository } from '../../infrastructure/typeorm-salary-payment.repository';
import { TeamPlugin } from '../../team.plugin';
import { describeCommissionConfigRepositoryContract } from '../contract/commission-config-repository.contract';
import { describeInvitationRepositoryContract } from '../contract/invitation-repository.contract';
import { describeMemberRepositoryContract } from '../contract/member-repository.contract';
import type { RepositoryHarness } from '../contract/repository-harness';
import { describeSalaryPaymentRepositoryContract } from '../contract/salary-payment-repository.contract';
import { invitedMember, openInvitation, scopeA } from '../support/builders';
import { authTestOptions, OUTBOX_SCHEMAS, teamOutboxPlugins } from './team-kit';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

const { server } = createPluginTestEnvironment({
  plugins: [
    PlatformPartitionsPlugin,
    RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
    TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1007 }),
    // Team writes `salary.paid` to the outbox (D222), whose tables are partitioned.
    ...teamOutboxPlugins(),
    RbacPlugin,
    // Team's invitations need auth's invited accounts and mail queue.
    AuthPlugin.init(authTestOptions()),
    TeamPlugin.init({ dashboardUrl: 'http://localhost:3100/dashboard' }),
  ],
  db: loadPluginTestDbConfig(process.env),
});
// rbac registers its partitioned `activity_log` with the maintenance too, which fails on a table that was never made.
withPartitionedSchemas(server, [...OUTBOX_SCHEMAS, ACTIVITY_LOG_SCHEMA], PartitionMaintenanceService);

let requestContext: RequestContext;
let ctx: OperationContext;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  requestContext = await server.app.get(RequestContextService).create({ apiType: 'admin' });
  ctx = asOperationContext(requestContext);
});

afterAll(async () => {
  await server.destroy();
});

type Entity =
  typeof TeamMemberEntity | typeof InvitationEntity | typeof CommissionConfigEntity | typeof SalaryPaymentEntity;

/** Each contract case starts from an empty table (test-only direct access), on a fresh adapter. */
function harness<R>(
  entity: Entity,
  build: (factory: TenantRepositoryFactory) => R,
): () => Promise<RepositoryHarness<R>> {
  return async () => {
    await server.app.get(TransactionalConnection).rawConnection.getRepository(entity).clear();
    const connection = server.app.get(TransactionalConnection);
    return {
      repo: build(server.app.get(TenantRepositoryFactory)),
      ctx,
      inTransaction: (work) =>
        connection.withTransaction(requestContext, (transactional) => work(asOperationContext(transactional))),
    };
  };
}

describeMemberRepositoryContract(
  'TypeOrmMemberRepository',
  harness(TeamMemberEntity, (factory) => new TypeOrmMemberRepository(factory)),
);
describeInvitationRepositoryContract(
  'TypeOrmInvitationRepository',
  harness(InvitationEntity, (factory) => new TypeOrmInvitationRepository(factory)),
);
describeCommissionConfigRepositoryContract(
  'TypeOrmCommissionConfigRepository',
  harness(CommissionConfigEntity, (factory) => new TypeOrmCommissionConfigRepository(factory)),
);
describeSalaryPaymentRepositoryContract(
  'TypeOrmSalaryPaymentRepository',
  harness(SalaryPaymentEntity, (factory) => new TypeOrmSalaryPaymentRepository(factory)),
);

it('keeps the token hash column out of every generic read', () => {
  // Act
  const column = server.app
    .get(TransactionalConnection)
    .rawConnection.getMetadata(InvitationEntity)
    .findColumnWithPropertyName('tokenHash');

  // Assert
  expect(column?.isSelect).toBe(false);
});

it('has the partial unique indexes the member rules rely on', async () => {
  // Act
  const indexes = await server.app
    .get(TransactionalConnection)
    .rawConnection.query<{ indexdef: string }[]>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'team_member'`);

  // Assert
  const definitions = indexes.map((index) => index.indexdef).join('\n');
  expect(definitions).toMatch(/UNIQUE INDEX .*\("businessId", "emailKey"\) WHERE \("removedAt" IS NULL\)/);
  expect(definitions).toMatch(
    /UNIQUE INDEX .*\("businessId", "administratorId"\) WHERE \("administratorId" IS NOT NULL\)/,
  );
  expect(definitions).toContain('("businessId", status, id)');
});

it('replaces the stored token hash on a resend patch, so the old token stops matching (D205)', async () => {
  // Arrange
  const connection = server.app.get(TransactionalConnection).rawConnection;
  await connection.getRepository(InvitationEntity).clear();
  const repo = new TypeOrmInvitationRepository(server.app.get(TenantRepositoryFactory));
  const oldHash = 'e'.repeat(64);
  const newHash = 'd'.repeat(64);
  const invitation = openInvitation(invitedMember(scopeA), { tokenHash: oldHash });
  await repo.insert(ctx, scopeA, invitation);

  // Act
  await repo.update(ctx, scopeA, invitation.id, { tokenHash: newHash });

  // Assert
  const stored = await connection.query<{ tokenHash: string }[]>('SELECT "tokenHash" FROM invitation WHERE id = $1', [
    invitation.id,
  ]);
  const withOldHash = await connection.query<{ id: string }[]>('SELECT id FROM invitation WHERE "tokenHash" = $1', [
    oldHash,
  ]);
  expect(stored).toEqual([{ tokenHash: newHash }]);
  expect(withOldHash).toEqual([]);
});
