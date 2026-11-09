import { asOperationContext } from '../../domain/ports/operation-context';
import { toBusinessId, toStoreId, vendurePermissionName } from '@cod/shared';
import {
  type BusinessFixture,
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActivityLogService } from '../../application/activity-log.service';
import { ACTIVITY_LOG } from '../../application/tokens';
import type { ActivityEntryInput } from '../../domain/activity';
import type { TypeOrmActivityLogRepository } from '../../infrastructure/typeorm-activity-log.repository';
import { ACTIVE_ADMINISTRATOR, ACTIVITY_LOG_QUERY, type Filters, type Page } from './activity-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1010;
const SEEDED_ROWS = 120;
const SMALL_BUSINESS_ROWS = 3;
const PAGE_SIZE = 50;
const SEED_ACTION = 'seed.row';
const BACKWARD_BUSINESS_ID_INDEX = 'IDX_0b24949b8eaf781c929ae2a59e';
const VIEW_LOG = vendurePermissionName('settings.activity-log.view');

describe('the activity log', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let service: ActivityLogService;
  let operation: ReturnType<typeof asOperationContext>;
  let storeOneViewer: CredentialsFixture;
  let bystander: CredentialsFixture;
  let ownerAdministratorId: number;

  const scopeOf = (business: BusinessFixture) => ({ businessId: toBusinessId(business.businessId) });

  const seed = (business: BusinessFixture, overrides: Partial<Omit<ActivityEntryInput, 'scope'>>): Promise<void> =>
    service.record(operation, {
      actorAdministratorId: null,
      action: SEED_ACTION,
      entityType: 'seed',
      entityId: '0',
      summary: 'Seeded',
      diff: {},
      ip: null,
      userAgent: null,
      ...overrides,
      scope: scopeOf(business),
    });

  const list = async (filters: Filters = {}): Promise<Page['activityLog']> =>
    (await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: filters })).activityLog;

  const entityIds = async (filters: Filters): Promise<string[]> =>
    (await list(filters)).items.map((item) => item.entityId);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    service = server.app.get(ActivityLogService);
    operation = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
    storeOneViewer = await createMember(server.app, adminClient, {
      code: 'activity-viewer',
      business: businesses.a,
      store: businesses.a.stores[0],
      permissions: ['Authenticated', VIEW_LOG],
    });
    bystander = await createMember(server.app, adminClient, {
      code: 'activity-bystander',
      business: businesses.a,
      store: businesses.a.stores[0],
      permissions: ['Authenticated'],
    });
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
    const { activeAdministrator } = await adminClient.query<{ activeAdministrator: { id: string } }>(
      ACTIVE_ADMINISTRATOR,
    );
    ownerAdministratorId = Number(activeAdministrator.id.replace('T_', ''));
    for (let index = 0; index < SEEDED_ROWS; index += 1) {
      await seed(businesses.a, { entityId: String(index) });
    }
    for (let index = 0; index < SMALL_BUSINESS_ROWS; index += 1) {
      await seed(businesses.b, { entityId: String(index) });
    }
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  describe('paging', () => {
    it('lists 120 rows without gap or duplicate while rows are added between pages', async () => {
      // Arrange
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
      const seen: string[] = [];
      let after: string | undefined;
      let pages = 0;

      // Act
      do {
        const page = await list({ first: PAGE_SIZE, after, action: SEED_ACTION });
        seen.push(...page.items.map((item) => item.entityId));
        after = page.nextCursor ?? undefined;
        pages += 1;
        await seed(businesses.a, { entityId: `late-${String(pages)}` });
      } while (after !== undefined);

      // Assert
      const expected = Array.from({ length: SEEDED_ROWS }, (_, index) => String(SEEDED_ROWS - 1 - index));
      expect(seen).toEqual(expected);
      expect(pages).toBe(3);
    });

    // Business B holds a small share of the table, as a business does in production; for a business that holds
    // nearly every row, the planner is right to walk the primary key instead.
    it('serves the default list from the (business, id) index, scanned backward', async () => {
      // Arrange
      const repository = server.app.get<TypeOrmActivityLogRepository>(ACTIVITY_LOG, { strict: false });
      const select = repository.listQuery(operation, scopeOf(businesses.b), {
        limit: PAGE_SIZE + 1,
        visibleStoreIds: [toStoreId(businesses.b.stores[0].id), toStoreId(businesses.b.stores[1].id)],
      });
      const [sql, parameters] = select.getQueryAndParameters();
      const runner = server.app.get(TransactionalConnection).rawConnection.createQueryRunner();

      // Act
      await runner.query('ANALYZE "activity_log"');
      await runner.startTransaction();
      let plan: string;
      try {
        await runner.query('SET LOCAL enable_seqscan = off');
        // A few rows are cheaper to sort than to walk in order; this asks whether an index can serve the order.
        await runner.query('SET LOCAL enable_bitmapscan = off');
        await runner.query('SET LOCAL enable_sort = off');
        plan = JSON.stringify(await runner.query(`EXPLAIN ${sql}`, parameters));
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }

      // Assert
      expect(plan).toContain(BACKWARD_BUSINESS_ID_INDEX);
      expect(plan).toContain('Backward');
    });
  });

  describe('filters', () => {
    it('narrows by actor, action, entity type and entity id, and names the actor', async () => {
      // Arrange
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
      await seed(businesses.a, {
        action: 'filter.action',
        entityType: 'filter-type',
        entityId: 'filter-entity',
        actorAdministratorId: ownerAdministratorId,
        summary: 'Filtered row',
        ip: '203.0.113.5',
      });

      // Act
      const byActor = await list({ actorAdministratorId: String(ownerAdministratorId) });
      const byAction = await entityIds({ action: 'filter.action' });
      const byType = await entityIds({ entityType: 'filter-type' });
      const byEntity = await entityIds({ entityId: 'filter-entity' });
      const stranger = await entityIds({ actorAdministratorId: '2147483647' });

      // Assert
      expect(byActor.items).toHaveLength(1);
      expect(byActor.items[0]).toMatchObject({
        entityId: 'filter-entity',
        summary: 'Filtered row',
        ip: '203.0.113.5',
        actor: { id: String(ownerAdministratorId), name: 'a Owner' },
        storeId: null,
      });
      expect(byAction).toEqual(['filter-entity']);
      expect(byType).toEqual(['filter-entity']);
      expect(byEntity).toEqual(['filter-entity']);
      expect(stranger).toEqual([]);
    });

    it('answers an empty page for an administrator id that cannot be real', async () => {
      // Arrange
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

      // Act
      const page = await list({ actorAdministratorId: 'not-a-number' });

      // Assert
      expect(page).toEqual({ items: [], nextCursor: null });
    });

    it('refuses a cursor that is no id', async () => {
      // Arrange
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

      // Act
      const failure = await failureOf(list({ after: 'garbage' }));

      // Assert
      expect(failure.codes).toEqual(['rbac.activity-cursor-invalid']);
    });
  });

  describe('permission', () => {
    it('refuses a member without settings.activity-log.view with FORBIDDEN', async () => {
      // Arrange
      await actAs(adminClient, bystander, businesses.a.stores[0]);

      // Act
      const failure = await failureOf(list());

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('shows a store row only to a member with access to that store', async () => {
      // Arrange
      const [storeOne, storeTwo] = businesses.a.stores;
      await seed(businesses.a, { entityType: 'store-visibility', entityId: 'in', storeId: toStoreId(storeOne.id) });
      await seed(businesses.a, { entityType: 'store-visibility', entityId: 'out', storeId: toStoreId(storeTwo.id) });
      await seed(businesses.a, { entityType: 'store-visibility', entityId: 'business-wide' });

      // Act
      await actAs(adminClient, storeOneViewer, storeOne);
      const asMember = await entityIds({ entityType: 'store-visibility' });
      await actAs(adminClient, businesses.a.owner, storeOne);
      const asOwner = await entityIds({ entityType: 'store-visibility' });

      // Assert
      expect(asMember.sort()).toEqual(['business-wide', 'in']);
      expect(asOwner.sort()).toEqual(['business-wide', 'in', 'out']);
    });
  });

  describe('two businesses', () => {
    it("never lists another business's row, and finds one's own", async () => {
      // Arrange
      await seed(businesses.b, { entityType: 'isolation', entityId: 'b-secret' });
      await seed(businesses.a, { entityType: 'isolation', entityId: 'a-own' });

      // Act
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
      const everyIsolationRowOfA = await entityIds({ entityType: 'isolation' });
      const aFilteringForB = await entityIds({ entityId: 'b-secret' });
      const aFilteringForOwn = await entityIds({ entityId: 'a-own' });
      await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
      const bFilteringForOwn = await entityIds({ entityId: 'b-secret' });

      // Assert
      expect(everyIsolationRowOfA).toEqual(['a-own']);
      expect(aFilteringForB).toEqual([]);
      expect(aFilteringForOwn).toEqual(['a-own']);
      expect(bFilteringForOwn).toEqual(['b-secret']);
    });
  });
});
