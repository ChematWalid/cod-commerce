import { beforeEach, describe, expect, it } from 'vitest';
import { DemoCollectionSeedService } from '../../application/demo-collection-seed.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { scopeA, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const DEMO = [
  { title: 'Apparel', slug: 'apparel', position: 0 },
  { title: 'Home', slug: 'home', position: 1 },
] as const;

let world: FakeCollectionWorld;
let service: DemoCollectionSeedService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  service = new DemoCollectionSeedService(world.ports);
});

describe('DemoCollectionSeedService.ensureManual', () => {
  it('creates each demo collection as a visible manual collection and answers its id by slug', async () => {
    // Act
    const seeded = await service.ensureManual(ctx, scopeA, DEMO);

    // Assert
    expect(seeded.created).toEqual(['apparel', 'home']);
    expect([...seeded.idsBySlug.keys()]).toEqual(['apparel', 'home']);
    for (const input of DEMO) {
      const id = seeded.idsBySlug.get(input.slug) ?? '';
      const definition = await world.tables.definitions.findByCollectionId(ctx, scopeA, id);
      expect(definition, input.slug).toMatchObject({ mode: 'manual', visible: true, position: input.position });
      expect(world.vendure.rows.get(id)?.isPrivate, input.slug).toBe(false);
    }
  });

  it('creates nothing on a second run and answers the same ids', async () => {
    // Arrange
    const first = await service.ensureManual(ctx, scopeA, DEMO);

    // Act
    const second = await service.ensureManual(ctx, scopeA, DEMO);

    // Assert
    expect(second.created).toEqual([]);
    expect(second.idsBySlug).toEqual(first.idsBySlug);
    expect(await world.tables.definitions.countInStore(ctx, scopeA)).toBe(DEMO.length);
  });

  it("seeds business B's store whatever business A's store already holds", async () => {
    // Arrange
    const ofA = await service.ensureManual(ctx, scopeA, DEMO);

    // Act: the fake channel keeps one slug space, so B's language gets slugs of its own, as the demo words do.
    const ofB = await service.ensureManual(ctx, scopeB, [{ title: 'Maison', slug: 'maison', position: 0 }]);

    // Assert
    expect(ofB.created).toEqual(['maison']);
    expect([...ofB.idsBySlug.values()].some((id) => [...ofA.idsBySlug.values()].includes(id))).toBe(false);
    expect(await world.tables.definitions.countInStore(ctx, scopeA)).toBe(DEMO.length);
  });
});
