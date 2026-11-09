import { asOperationContext } from '../../domain/ports/operation-context';
import { type StoreId, toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ActivityLogService } from '../../application/activity-log.service';
import { GetActivityLogService } from '../../application/get-activity-log.service';
import { type ActivityEntryInput, ActivityCursorInvalidError, ActivityEntryInvalidError } from '../../domain/activity';
import { FakeActorDirectory } from '../fakes/fake-actor-directory';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryActivityLog } from '../fakes/in-memory-activity-log';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

const ctx = asOperationContext({});
const scopeA = { businessId: toBusinessId('1001') };
const scopeB = { businessId: toBusinessId('2002') };
const NOW = new Date('2026-05-06T07:08:09.000Z');
const STORE_1 = toStoreId('5001');
const STORE_2 = toStoreId('5002');

const entry = (overrides: Partial<ActivityEntryInput> = {}): ActivityEntryInput => ({
  scope: scopeA,
  actorAdministratorId: 7,
  action: 'rbac.role.created',
  entityType: 'role',
  entityId: '42',
  summary: 'Created a role',
  diff: {},
  ip: '203.0.113.9',
  userAgent: 'test-agent',
  ...overrides,
});

function setup(): { log: InMemoryActivityLog; record: ActivityLogService; read: GetActivityLogService } {
  const log = new InMemoryActivityLog();
  return {
    log,
    record: new ActivityLogService(log, new SequentialIdGenerator(), new FixedClock(NOW)),
    read: new GetActivityLogService(log, new FakeActorDirectory(new Map([[7, 'Amina Benali']]))),
  };
}

const request = (visibleStoreIds: readonly StoreId[] = []) => ({ visibleStoreIds });

describe('ActivityLogService.record', () => {
  it('stores the entry with an id, the time and a sanitized diff', async () => {
    // Arrange
    const { log, record } = setup();

    // Act
    await record.record(ctx, entry({ diff: { after: { passwordHash: 'x', name: 'n' } } }));

    // Assert
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toMatchObject({
      id: '1',
      createdAt: NOW,
      diff: { after: { passwordHash: '[REDACTED]', name: 'n' } },
    });
  });

  it('clips the summary and the user agent to their columns', async () => {
    // Arrange
    const { log, record } = setup();

    // Act
    await record.record(ctx, entry({ summary: 's'.repeat(400), userAgent: 'u'.repeat(400) }));

    // Assert
    expect(log.entries[0]?.summary).toHaveLength(255);
    expect(log.entries[0]?.userAgent).toHaveLength(255);
  });

  it.each([
    ['an empty action', { action: ' ' }],
    ['an action over 64 characters', { action: 'a'.repeat(65) }],
    ['an entity type over 32 characters', { entityType: 't'.repeat(33) }],
    ['an entity id over 32 characters', { entityId: 'i'.repeat(33) }],
  ])('refuses %s and stores nothing', async (_name, overrides) => {
    // Arrange
    const { log, record } = setup();

    // Act
    const attempt = record.record(ctx, entry(overrides));

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ActivityEntryInvalidError);
    expect(log.entries).toHaveLength(0);
  });
});

describe('GetActivityLogService.list', () => {
  it('pages newest first without gap or duplicate, with the actor named', async () => {
    // Arrange
    const { record, read } = setup();
    for (let index = 0; index < 5; index += 1) await record.record(ctx, entry({ entityId: String(index) }));

    // Act
    const first = await read.list(ctx, scopeA, { ...request(), first: 2 });
    const second = await read.list(ctx, scopeA, { ...request(), first: 2, after: first.nextCursor ?? undefined });
    const third = await read.list(ctx, scopeA, { ...request(), first: 2, after: second.nextCursor ?? undefined });

    // Assert
    expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(['5', '4', '3', '2', '1']);
    expect(third.nextCursor).toBeNull();
    expect(first.items[0]?.actor).toEqual({ id: '7', name: 'Amina Benali' });
  });

  it('caps a page at 100 rows and defaults to 50', async () => {
    // Arrange
    const { record, read } = setup();
    for (let index = 0; index < 120; index += 1) await record.record(ctx, entry());

    // Act
    const defaulted = await read.list(ctx, scopeA, request());
    const capped = await read.list(ctx, scopeA, { ...request(), first: 1000 });

    // Assert
    expect(defaulted.items).toHaveLength(50);
    expect(capped.items).toHaveLength(100);
  });

  it('narrows by each filter', async () => {
    // Arrange
    const { record, read } = setup();
    await record.record(ctx, entry({ action: 'a.one', entityType: 'role', entityId: '1', actorAdministratorId: 7 }));
    await record.record(
      ctx,
      entry({ action: 'a.two', entityType: 'member', entityId: '2', actorAdministratorId: null }),
    );

    // Act
    const byAction = await read.list(ctx, scopeA, { ...request(), action: 'a.two' });
    const byType = await read.list(ctx, scopeA, { ...request(), entityType: 'role' });
    const byEntity = await read.list(ctx, scopeA, { ...request(), entityId: '2' });
    const byActor = await read.list(ctx, scopeA, { ...request(), actorAdministratorId: '7' });

    // Assert
    expect(byAction.items.map((item) => item.id)).toEqual(['2']);
    expect(byType.items.map((item) => item.id)).toEqual(['1']);
    expect(byEntity.items.map((item) => item.id)).toEqual(['2']);
    expect(byActor.items.map((item) => item.id)).toEqual(['1']);
    expect(byAction.items[0]?.actor).toBeNull();
  });

  it.each(['abc', '0', '-1', '01', '2147483648', '99999999999'])(
    'answers an empty page for the administrator id %s',
    async (id) => {
      // Arrange
      const { record, read } = setup();
      await record.record(ctx, entry());

      // Act
      const page = await read.list(ctx, scopeA, { ...request(), actorAdministratorId: id });

      // Assert
      expect(page).toEqual({ items: [], nextCursor: null });
    },
  );

  it('rejects a cursor that is no id', async () => {
    // Arrange
    const { read } = setup();

    // Act
    const attempt = read.list(ctx, scopeA, { ...request(), after: 'not-an-id' });

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ActivityCursorInvalidError);
  });

  it('shows a store row only to a caller with access to that store', async () => {
    // Arrange
    const { record, read } = setup();
    await record.record(ctx, entry({ entityId: 'business' }));
    await record.record(ctx, entry({ entityId: 'one', storeId: STORE_1 }));
    await record.record(ctx, entry({ entityId: 'two', storeId: STORE_2 }));

    // Act
    const page = await read.list(ctx, scopeA, request([STORE_1]));

    // Assert
    expect(page.items.map((item) => item.entityId)).toEqual(['one', 'business']);
  });

  it("never returns another business's row, and finds one's own", async () => {
    // Arrange
    const { record, read } = setup();
    await record.record(ctx, entry({ scope: scopeB, entityId: 'b-row' }));
    await record.record(ctx, entry({ scope: scopeA, entityId: 'a-row' }));

    // Act
    const page = await read.list(ctx, scopeA, { ...request(), entityId: 'b-row' });
    const own = await read.list(ctx, scopeA, { ...request(), entityId: 'a-row' });

    // Assert
    expect(page.items).toEqual([]);
    expect(own.items).toHaveLength(1);
  });
});
