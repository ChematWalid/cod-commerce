import { COLLECTION_LIST_MAX_TAKE } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { CreateCollectionService } from './create-collection.service';
import { ListCollectionsService } from './list-collections.service';
import { RecomputeMembershipService } from './recompute-membership.service';
import type { SaveTimeRecompute } from './save-recompute.service';

/** One demo collection a store should hold: manual and visible, at `position`. */
export interface DemoCollectionInput {
  readonly title: string;
  readonly slug: string;
  readonly position: number;
}

/** What a demo collection seed found or made: each collection's id by slug, and the slugs this run created. */
export interface DemoCollectionsSeeded {
  readonly idsBySlug: ReadonlyMap<string, string>;
  readonly created: readonly string[];
}

/**
 * Gives a demo store its demo collections (P3.S2) through the same use case a merchant's save runs, so every rule of
 * a collection holds (store lock, cap, `collection.changed`). A collection whose slug the store already holds is
 * reused, so a second run creates nothing. Products join them through the catalog's own save (manual membership).
 */
export class DemoCollectionSeedService {
  private readonly creating: CreateCollectionService;
  private readonly listing: ListCollectionsService;

  constructor(ports: CollectionPorts, recompute: SaveTimeRecompute = new RecomputeMembershipService(ports)) {
    this.creating = new CreateCollectionService(ports, recompute);
    this.listing = new ListCollectionsService(ports);
  }

  /** Ensures each of `inputs` exists in the store of `scope`, whose channel `ctx` runs in. */
  async ensureManual(
    ctx: OperationContext,
    scope: StoreScope,
    inputs: readonly DemoCollectionInput[],
  ): Promise<DemoCollectionsSeeded> {
    const existing = await this.listing.list(ctx, scope, { skip: 0, take: COLLECTION_LIST_MAX_TAKE });
    const held = new Map(existing.items.map((view) => [view.slug, view.id]));
    const idsBySlug = new Map<string, string>();
    const created: string[] = [];
    for (const input of inputs) {
      const id = held.get(input.slug) ?? (await this.create(ctx, scope, input));
      if (!held.has(input.slug)) created.push(input.slug);
      idsBySlug.set(input.slug, id);
    }
    return { idsBySlug, created };
  }

  private async create(ctx: OperationContext, scope: StoreScope, input: DemoCollectionInput): Promise<string> {
    const view = await this.creating.create(ctx, scope, {
      ...input,
      description: null,
      featuredAssetId: null,
      visible: true,
      mode: 'manual',
      rule: undefined,
    });
    return view.id;
  }
}
