import {
  COLLECTIONS_ERROR_CODES,
  COLLECTIONS_PER_STORE_MAX,
  type CreateStoreCollectionCommand,
  NORMAL_FORM_VERSION,
} from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateCollectionService } from '../../application/create-collection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { definitionOf, priceRule, scopeA, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const command = (overrides: Partial<CreateStoreCollectionCommand> = {}): CreateStoreCollectionCommand => ({
  title: 'Summer',
  slug: 'summer',
  description: null,
  featuredAssetId: null,
  visible: true,
  position: 3,
  mode: 'manual',
  rule: undefined,
  ...overrides,
});

let world: FakeCollectionWorld;
let service: CreateCollectionService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  service = new CreateCollectionService(world.ports);
});

describe('CreateCollectionService.create', () => {
  it('stores the Vendure collection and a manual definition, publishes created and answers the view', async () => {
    // Act
    const view = await service.create(ctx, scopeA, command({ visible: false, featuredAssetId: '31' }));

    // Assert
    expect(view).toEqual({
      id: view.id,
      title: 'Summer',
      slug: 'summer',
      description: null,
      featuredAsset: { id: '31', preview: 'https://assets.test/preview/31' },
      mode: 'manual',
      rule: null,
      visible: false,
      position: 3,
      productCount: 0,
    });
    expect(world.vendure.rows.get(view.id)?.isPrivate).toBe(true);
    const stored = await world.tables.definitions.findByCollectionId(ctx, scopeA, view.id);
    expect(stored).toMatchObject({ mode: 'manual', rule: null, matchVersion: NORMAL_FORM_VERSION, position: 3 });
    expect(world.events.published).toEqual([{ scope: scopeA, collectionId: view.id, change: 'created' }]);
  });

  it('takes the store lock inside its transaction before counting the store collections', async () => {
    // Act
    await service.create(ctx, scopeA, command());

    // Assert
    expect(world.steps).toEqual(['transaction', `lock ${scopeA.storeId}`, 'count']);
  });

  it('refuses the 501st collection of a store with too-many-collections and writes nothing', async () => {
    // Arrange
    for (let index = 0; index < COLLECTIONS_PER_STORE_MAX; index += 1) {
      await world.tables.definitions.insert(ctx, scopeA, definitionOf(scopeA));
    }

    // Act
    const created = service.create(ctx, scopeA, command());

    // Assert
    await expect(created).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.TOO_MANY_COLLECTIONS });
    expect(world.vendure.rows.size).toBe(0);
  });

  it('accepts the 500th collection of a store and refuses the one after it', async () => {
    // Arrange
    for (let index = 0; index < COLLECTIONS_PER_STORE_MAX - 1; index += 1) {
      await world.tables.definitions.insert(ctx, scopeA, definitionOf(scopeA));
    }

    // Act
    const last = await service.create(ctx, scopeA, command({ slug: 'last' }));
    const extra = service.create(ctx, scopeA, command({ slug: 'extra' }));

    // Assert
    expect(last.slug).toBe('last');
    await expect(extra).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.TOO_MANY_COLLECTIONS });
    expect(await world.tables.definitions.countInStore(ctx, scopeA)).toBe(COLLECTIONS_PER_STORE_MAX);
  });

  it("counts only the caller's store toward the cap", async () => {
    // Arrange
    for (let index = 0; index < COLLECTIONS_PER_STORE_MAX; index += 1) {
      await world.tables.definitions.insert(ctx, scopeB, definitionOf(scopeB));
    }

    // Act
    const view = await service.create(ctx, scopeA, command());

    // Assert
    expect(view.title).toBe('Summer');
  });

  it('refuses a slug another collection of the store uses with slug-taken and writes nothing', async () => {
    // Arrange
    await service.create(ctx, scopeA, command());

    // Act
    const second = service.create(ctx, scopeA, command({ title: 'Other' }));

    // Assert
    await expect(second).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.SLUG_TAKEN });
    expect(world.vendure.rows.size).toBe(1);
    expect(world.events.published).toHaveLength(1);
  });

  it('derives the slug from the title when none is given', async () => {
    // Act
    const view = await service.create(ctx, scopeA, command({ title: 'Winter Sale', slug: undefined }));

    // Assert
    expect(view.slug).toBe('winter-sale');
  });

  it.each(['99', 'abc', '-1', ''])(
    'refuses the image %j, not an asset of the store, with image-not-found',
    async (id) => {
      // Act
      const created = service.create(ctx, scopeA, command({ featuredAssetId: id }));

      // Assert
      await expect(created).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND });
      expect(world.vendure.rows.size).toBe(0);
    },
  );

  it('refuses an automatic collection with rule-invalid until rule saves land (Task 7)', async () => {
    // Act
    const created = service.create(ctx, scopeA, command({ mode: 'automatic', rule: priceRule(1, 2) }));

    // Assert
    await expect(created).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.RULE_INVALID });
    expect(world.steps).toEqual([]);
  });

  it('keeps the sanitised description and reads a blank result as no description', async () => {
    // Act
    const kept = await service.create(ctx, scopeA, command({ description: '<p>Light <b>fabrics</b></p>' }));
    const blank = await service.create(ctx, scopeA, command({ slug: 'blank', description: '<p> </p>' }));

    // Assert
    expect(kept.description).toBe('Light fabrics');
    expect(blank.description).toBeNull();
  });
});
