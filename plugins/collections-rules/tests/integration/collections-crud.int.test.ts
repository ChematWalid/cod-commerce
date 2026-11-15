import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { COLLECTIONS_ERROR_CODES, COLLECTIONS_PER_STORE_MAX, toBusinessId, toStoreId } from '@cod/shared';
import { CollectionService, RequestContextService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { OutboxCollectionEvents } from '../../infrastructure/collection-events';
import { TypeOrmCollectionDefinitionRepository } from '../../infrastructure/typeorm-collection-definition.repository';
import { definitionOf } from '../support/builders';
import {
  COLLECTION,
  COLLECTIONS,
  type CollectionResult,
  createCollection,
  DELETE_COLLECTION,
  rawId,
  UPDATE_COLLECTION,
} from './collections-api';
import { collectionsWithSlug, uploadImage } from './collections-images';
import { collectionsSuite } from './collections-kit';

const suite = collectionsSuite(1016, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

interface ErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

/** The error code a GraphQL call failed with. */
async function codeOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
    return undefined;
  } catch (error: unknown) {
    return (error as ErrorShape).response?.errors?.[0]?.extensions?.code;
  }
}

/** The kinds of `collection.changed` the outbox holds for a collection, oldest first. */
async function changesOf(collectionId: string): Promise<string[]> {
  const rows = await suite.kit.query<{ change: string }>(
    `SELECT payload->>'change' AS change FROM outbox_event
      WHERE topic = 'collection.changed' AND payload->>'collectionId' = $1 ORDER BY id`,
    [collectionId],
  );
  return rows.map((row) => row.change);
}

describe('collections CRUD over GraphQL', () => {
  it('creates, reads, edits and deletes a collection of the active store', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const created = await createCollection(suite.kit, { title: 'Summer', slug: 'summer', description: '<p>Light</p>' });
    const { updateStoreCollection: updated } = await suite.kit.gql<{ updateStoreCollection: CollectionResult }>(
      UPDATE_COLLECTION,
      { id: created.id, input: { title: 'Summer 2026', visible: false, position: 4 } },
    );
    const { storeCollection: read } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: created.id,
    });
    await suite.kit.gql(DELETE_COLLECTION, { id: created.id });
    const { storeCollection: gone } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: created.id,
    });

    // Assert
    expect(created).toMatchObject({ title: 'Summer', slug: 'summer', description: '<p>Light</p>', mode: 'manual' });
    expect(updated).toMatchObject({
      title: 'Summer 2026',
      slug: 'summer',
      visible: false,
      position: 4,
      productCount: 0,
    });
    expect(read).toEqual(updated);
    expect(gone).toBeNull();
  });

  it('lists the store collections by position and searches their titles', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const later = await createCollection(suite.kit, { title: 'أحذية رياضية', position: 2 });
    const first = await createCollection(suite.kit, { title: 'Bags', position: 1 });

    // Act
    const { storeCollections: all } = await suite.kit.gql<{ storeCollections: { items: CollectionResult[] } }>(
      COLLECTIONS,
    );
    const { storeCollections: found } = await suite.kit.gql<{ storeCollections: { items: CollectionResult[] } }>(
      COLLECTIONS,
      { options: { search: 'احذيه' } },
    );

    // Assert
    expect(all.items.map((item) => item.id)).toEqual([first.id, later.id]);
    expect(found.items.map((item) => item.id)).toEqual([later.id]);
  });

  it('refuses a taken slug of the store and an automatic collection until rules land', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await createCollection(suite.kit, { slug: 'taken-slug' });
    const rule = { version: 1, match: 'all', conditions: [{ field: 'on_sale', operator: 'is', value: true }] };

    // Act
    const codes = await Promise.all([
      codeOf(createCollection(suite.kit, { slug: 'taken-slug' })),
      codeOf(createCollection(suite.kit, { mode: 'automatic', rule })),
    ]);

    // Assert
    expect(codes).toEqual([COLLECTIONS_ERROR_CODES.SLUG_TAKEN, COLLECTIONS_ERROR_CODES.RULE_INVALID]);
  });
});

describe('the collection image (D2320)', () => {
  it('shows an image of the store with an absolute preview, and an edit with null clears it', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const assetId = await uploadImage(suite.kit);

    // Act
    const created = await createCollection(suite.kit, { featuredAssetId: assetId });
    const { updateStoreCollection: cleared } = await suite.kit.gql<{ updateStoreCollection: CollectionResult }>(
      UPDATE_COLLECTION,
      { id: created.id, input: { featuredAssetId: null } },
    );
    const { storeCollection: read } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: created.id,
    });

    // Assert
    expect(created.featuredAsset?.id).toBe(assetId);
    // The test server's asset storage makes an identifier absolute as `test-url/<identifier>`.
    expect(created.featuredAsset?.preview).toMatch(/^test-url\/test-assets\//);
    expect(cleared.featuredAsset).toBeNull();
    expect(read?.featuredAsset).toBeNull();
  });
});

describe('one transaction per create (D2333, D2335)', () => {
  it('a failure after the Vendure collection is made leaves no collection, definition or event', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const slug = 'rolled-back-create';
    const before = await suite.kit.query<{ count: string }>(
      'SELECT count(*) AS count FROM collections_definition WHERE "storeId" = $1',
      [a.stores[0].id],
    );
    const publish = vi
      .spyOn(OutboxCollectionEvents.prototype, 'publish')
      .mockRejectedValueOnce(new Error('synthetic outbox failure'));

    // Act
    const failed = await codeOf(createCollection(suite.kit, { slug }));
    const publishCalls = publish.mock.calls.length;
    publish.mockRestore();

    // Assert
    expect(failed).toBe('INTERNAL_SERVER_ERROR');
    expect(publishCalls).toBe(1);
    expect(await collectionsWithSlug(suite.kit, slug)).toBe(0);
    const after = await suite.kit.query<{ count: string }>(
      'SELECT count(*) AS count FROM collections_definition WHERE "storeId" = $1',
      [a.stores[0].id],
    );
    expect(after).toEqual(before);
  });
});

describe('collections CRUD over REST', () => {
  it('creates (201), reads, edits, lists and deletes a collection; a deleted one answers 404', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const body = { title: 'Winter', slug: 'winter', visible: true, position: 0, mode: 'manual' };

    // Act
    const created = await suite.kit.rest('POST', '/catalog/collections', body);
    const id = (created.body as { id: string }).id;
    const patched = await suite.kit.rest('PATCH', `/catalog/collections/${id}`, { title: 'Winter Sale' });
    const listed = await suite.kit.rest('GET', '/catalog/collections?take=100&search=winter');
    const deleted = await suite.kit.rest('DELETE', `/catalog/collections/${id}`);
    const gone = await suite.kit.rest('GET', `/catalog/collections/${id}`);

    // Assert
    expect(created.status).toBe(201);
    expect(patched.body).toMatchObject({ id, title: 'Winter Sale', slug: 'winter' });
    expect(listed.body).toMatchObject({ totalItems: 1, items: [{ id }] });
    expect(deleted.body).toEqual({ success: true });
    expect(gone.status).toBe(404);
    expect(gone.body).toMatchObject({ code: COLLECTIONS_ERROR_CODES.NOT_FOUND });
  });
});

describe('the store channel only (D2333)', () => {
  it('a created collection is not in the default channel', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const created = await createCollection(suite.kit);
    const app = suite.kit.app;
    const defaultCtx = await app.get(RequestContextService).create({ apiType: 'admin' });

    // Act
    const inDefault = await app.get(CollectionService).findOne(defaultCtx, rawId(created.id));
    const channels = await suite.kit.query<{ token: string }>(
      `SELECT c.token FROM collection_channels_channel cc JOIN channel c ON c.id = cc."channelId"
        WHERE cc."collectionId" = $1`,
      [rawId(created.id)],
    );

    // Assert
    expect(inDefault).toBeUndefined();
    expect(channels.map((row) => row.token)).toEqual([a.stores[0].channelToken]);
  });
});

describe('the per-store cap and the outbox', () => {
  it('the 501st collection of a store is refused', async () => {
    // Arrange
    const { b } = suite.fixtures;
    const scope = { businessId: toBusinessId(b.businessId), storeId: toStoreId(b.stores[1].id) };
    const ctx = asOperationContext(await suite.kit.app.get(RequestContextService).create({ apiType: 'admin' }));
    const definitions = new TypeOrmCollectionDefinitionRepository(suite.kit.app.get(TenantRepositoryFactory));
    for (let index = 0; index < COLLECTIONS_PER_STORE_MAX; index += 1) {
      await definitions.insert(ctx, scope, definitionOf(scope, { collectionId: String(1_500_000 + index) }));
    }
    await suite.kit.asOwner(b, b.stores[1]);

    // Act
    const code = await codeOf(createCollection(suite.kit));

    // Assert
    expect(code).toBe(COLLECTIONS_ERROR_CODES.TOO_MANY_COLLECTIONS);
  });

  it('create, update and delete each publish collection.changed', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const created = await createCollection(suite.kit);

    // Act
    await suite.kit.gql(UPDATE_COLLECTION, { id: created.id, input: { position: 9 } });
    await suite.kit.gql(DELETE_COLLECTION, { id: created.id });

    // Assert
    expect(await changesOf(rawId(created.id))).toEqual(['created', 'updated', 'deleted']);
  });
});
