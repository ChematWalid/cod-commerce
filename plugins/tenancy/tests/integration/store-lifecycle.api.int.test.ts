import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_STORE,
  CHANGE_STORE_SUBDOMAIN,
  STORE,
  STORES,
  type StoreView,
  SUBDOMAIN_AVAILABILITY,
  UPDATE_STORE,
} from './admin-api-operations';
import { actAsMember, actAsOwner, createMember } from './admin-api-session';
import { failureOf } from '@cod/testing';
import { useStoreApi } from './store-api-harness';
import { provisionBusiness } from './tenant-fixtures';

describe('Store subdomain changes, archiving and member reach', () => {
  const api = useStoreApi(1004);
  const { server, adminClient, asAlpha, rows, channels, createStore } = api;

  it('changes the subdomain, lowercased, and frees the old one', async () => {
    // Arrange
    await asAlpha();
    const store = await createStore('before-move');

    // Act
    const { changeStoreSubdomain } = await adminClient.query<{ changeStoreSubdomain: StoreView }>(
      CHANGE_STORE_SUBDOMAIN,
      { id: store.id, subdomain: 'After-Move' },
    );
    const { subdomainAvailability } = await adminClient.query<{ subdomainAvailability: { status: string } }>(
      SUBDOMAIN_AVAILABILITY,
      { subdomain: 'before-move' },
    );

    // Assert
    expect(changeStoreSubdomain.subdomain).toBe('after-move');
    expect(subdomainAvailability.status).toBe('available');
  });

  it('refuses to change to a subdomain another store holds', async () => {
    // Arrange
    await asAlpha();

    // Act
    const failure = await failureOf(
      adminClient.query(CHANGE_STORE_SUBDOMAIN, { id: api.alpha.store.id, subdomain: 'bravo' }),
    );

    // Assert
    expect(failure.codes).toEqual(['tenancy.subdomain-taken']);
  });

  it('accepts a change to the subdomain the store already has', async () => {
    // Arrange
    await asAlpha();

    // Act
    const { changeStoreSubdomain } = await adminClient.query<{ changeStoreSubdomain: StoreView }>(
      CHANGE_STORE_SUBDOMAIN,
      { id: api.alpha.store.id, subdomain: 'alpha' },
    );

    // Assert
    expect(changeStoreSubdomain.subdomain).toBe('alpha');
  });

  it('archives softly, keeping the row, the channel and the subdomain', async () => {
    // Arrange
    await asAlpha();
    const store = await createStore('to-archive');

    // Act
    const { archiveStore } = await adminClient.query<{ archiveStore: StoreView }>(ARCHIVE_STORE, { id: store.id });
    const { store: reread } = await adminClient.query<{ store: StoreView }>(STORE, { id: store.id });
    const { subdomainAvailability } = await adminClient.query<{ subdomainAvailability: { status: string } }>(
      SUBDOMAIN_AVAILABILITY,
      { subdomain: 'to-archive' },
    );
    const row = await rows().findOneByOrFail({ id: store.id });

    // Assert
    expect(archiveStore.status).toBe('archived');
    expect(reread.status).toBe('archived');
    expect(subdomainAvailability.status).toBe('taken');
    expect(row.archivedAt).not.toBeNull();
    expect(await channels().existsBy({ id: row.channelId })).toBe(true);
  });

  it('keeps an archived store from releasing its subdomain or being edited', async () => {
    // Arrange
    await asAlpha();
    const store = await createStore('frozen');
    await adminClient.query(ARCHIVE_STORE, { id: store.id });

    // Act
    const rename = await failureOf(adminClient.query(CHANGE_STORE_SUBDOMAIN, { id: store.id, subdomain: 'thawed' }));
    const update = await failureOf(adminClient.query(UPDATE_STORE, { id: store.id, input: { name: 'x y' } }));

    // Assert
    expect(rename.codes).toEqual(['tenancy.store-archived']);
    expect(update.codes).toEqual(['tenancy.store-archived']);
  });

  it('refuses to archive the last active store', async () => {
    // Arrange: bravo has exactly one store.
    await actAsOwner(server.app, adminClient, 'bravo', api.bravo.store.channelId);

    // Act
    const failure = await failureOf(adminClient.query(ARCHIVE_STORE, { id: api.bravo.store.id }));

    // Assert
    expect(failure.codes).toEqual(['tenancy.last-store']);
    expect((await rows().findOneByOrFail({ id: api.bravo.store.id })).status).toBe('active');
  });

  it('never archives both of the last two stores when asked at once', async () => {
    // Arrange
    const charlie = await provisionBusiness(server.app, 'charlie');
    await actAsOwner(server.app, adminClient, 'charlie', charlie.store.channelId);
    const second = await createStore('charlie-two');

    // Act
    const outcomes = await Promise.allSettled([
      adminClient.query(ARCHIVE_STORE, { id: charlie.store.id }),
      adminClient.query(ARCHIVE_STORE, { id: second.id }),
    ]);
    const active = await rows().countBy({ businessId: charlie.business.id, status: 'active' });

    // Assert
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(active).toBe(1);
  });

  it('confines a member with a role on one store to that store', async () => {
    // Arrange
    const delta = await provisionBusiness(server.app, 'delta');
    await actAsOwner(server.app, adminClient, 'delta', delta.store.channelId);
    const other = await createStore('delta-two');
    await createMember(server.app, adminClient, {
      code: 'delta-member',
      businessId: delta.business.id,
      channelId: delta.store.channelId,
      permissions: ['Authenticated', 'ReadTenantStore', 'UpdateTenantStore'],
    });
    await actAsMember(server.app, adminClient, 'delta-member', delta.store.channelId);

    // Act
    const { stores } = await adminClient.query<{ stores: StoreView[] }>(STORES);
    const { store } = await adminClient.query<{ store: StoreView | null }>(STORE, { id: other.id });
    const update = await failureOf(adminClient.query(UPDATE_STORE, { id: other.id, input: { name: 'x y' } }));

    // Assert
    expect(stores.map((entry) => entry.id)).toEqual([delta.store.id]);
    expect(store).toBeNull();
    expect(update.codes).toEqual(['tenancy.store-not-found']);
  });
});
