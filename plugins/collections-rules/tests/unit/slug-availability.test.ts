import { beforeEach, describe, expect, it } from 'vitest';
import { SlugAvailabilityService } from '../../application/slug-availability.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { manualCollection } from '../support/arrange-collections';
import { scopeA } from '../support/builders';

const ctx = asOperationContext({});

let world: FakeCollectionWorld;
let service: SlugAvailabilityService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  service = new SlugAvailabilityService(world.ports);
});

const slugOf = async (collectionId: string): Promise<string> => {
  const meta = (await world.vendure.findMany(ctx, [collectionId])).get(collectionId);
  if (meta === undefined) throw new Error('the collection was just made');
  return meta.slug;
};

describe('SlugAvailabilityService.check', () => {
  it('answers a free slug available, in the form the store would keep', async () => {
    // Act
    const answer = await service.check(ctx, { slug: '  Summer Sale ' });

    // Assert
    expect(answer).toEqual({ slug: 'summer-sale', available: true });
  });

  it("answers another collection's slug taken, whatever its case", async () => {
    // Arrange
    const taken = await slugOf(await manualCollection(world, scopeA));

    // Act
    const answer = await service.check(ctx, { slug: taken.toUpperCase() });

    // Assert
    expect(answer).toEqual({ slug: taken, available: false });
  });

  it('answers the edited collection its own slug available', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);

    // Act
    const answer = await service.check(ctx, { slug: await slugOf(collectionId), collectionId });

    // Assert
    expect(answer.available).toBe(true);
  });

  it('reads a malformed collection id as none, so the slug stays taken', async () => {
    // Arrange
    const slug = await slugOf(await manualCollection(world, scopeA));

    // Act
    const answer = await service.check(ctx, { slug, collectionId: 'abc' });

    // Assert
    expect(answer.available).toBe(false);
  });
});
