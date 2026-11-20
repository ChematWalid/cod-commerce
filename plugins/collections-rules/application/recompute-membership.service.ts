import { NORMAL_FORM_VERSION } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { AUTOMATIC_MEMBER_POSITION } from '../domain/constants';
import { matchesRule } from '../domain/evaluate-rule';
import { canonicalProductId, ruleMembers } from '../domain/membership';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductFacts } from '../domain/product-facts';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { storeMatches } from './store-walk';

/** Where one product stands in the store's automatic collections after a change. */
interface ProductPlacement {
  readonly joined: readonly string[];
  readonly left: readonly string[];
}

/**
 * Keeps automatic collections' members equal to their rule's matches (D2312). Every write runs in a transaction under
 * the store lock (D2334), taken before any rule or fact is read, so concurrent or late recomputes end with membership
 * built from the latest committed rules and facts. Each changed collection publishes `collection.changed`
 * (`membership`, D2335).
 */
export class RecomputeMembershipService {
  constructor(private readonly ports: CollectionPorts) {}

  /**
   * Rebuilds one automatic collection over every product of the store (keyset pages, D2308) and records the normal
   * form version it was built with (D2336). A manual definition is answered unchanged.
   */
  async forStore(
    ctx: OperationContext,
    scope: StoreScope,
    definition: CollectionDefinition,
  ): Promise<CollectionDefinition> {
    const { rule } = definition;
    if (definition.mode !== 'automatic' || rule === null) return definition;
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const matched = await storeMatches(this.ports.facts, tx, scope, rule);
      await this.ports.members.replaceMembers(tx, scope, definition.collectionId, ruleMembers(matched));
      const current = { ...definition, matchVersion: NORMAL_FORM_VERSION };
      if (definition.matchVersion !== NORMAL_FORM_VERSION) await this.ports.definitions.update(tx, scope, current);
      await this.ports.events.publish(tx, scope, definition.collectionId, 'membership');
      return current;
    });
  }

  /**
   * Re-matches one product against every automatic collection of the store (a product change, D2312). A product the
   * store no longer has leaves every collection, manual ones included (D2306). Manual memberships are never touched
   * otherwise.
   */
  async forProduct(ctx: OperationContext, scope: StoreScope, rawProductId: string): Promise<void> {
    const productId = canonicalProductId(rawProductId);
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const before = (await this.ports.members.collectionIdsOfProducts(tx, scope, [productId])).get(productId) ?? [];
      const [facts] = await this.ports.facts.factsOf(tx, scope, [productId]);
      const changed =
        facts === undefined
          ? await this.removeProduct(tx, scope, productId, before)
          : await this.placeProduct(tx, scope, facts, before);
      for (const collectionId of changed) await this.ports.events.publish(tx, scope, collectionId, 'membership');
    });
  }

  private async removeProduct(
    tx: OperationContext,
    scope: StoreScope,
    productId: string,
    before: readonly string[],
  ): Promise<readonly string[]> {
    await this.ports.members.deleteProduct(tx, scope, productId);
    return before;
  }

  /** Puts the product in the automatic collections it matches and out of the others; answers those that changed. */
  private async placeProduct(
    tx: OperationContext,
    scope: StoreScope,
    facts: ProductFacts,
    before: readonly string[],
  ): Promise<readonly string[]> {
    const placement = this.placementOf(await this.ports.definitions.listAutomatic(tx, scope), facts);
    const wasIn = new Set(before);
    const joined = placement.joined.filter((collectionId) => !wasIn.has(collectionId));
    const left = placement.left.filter((collectionId) => wasIn.has(collectionId));
    if (joined.length === 0 && left.length === 0) return [];
    await this.ports.members.setProductIn(tx, scope, facts.productId, {
      in: joined.map((collectionId) => ({ collectionId, position: AUTOMATIC_MEMBER_POSITION })),
      out: left,
    });
    return [...joined, ...left];
  }

  private placementOf(automatic: readonly CollectionDefinition[], facts: ProductFacts): ProductPlacement {
    const joined: string[] = [];
    const left: string[] = [];
    for (const { collectionId, rule } of automatic) {
      if (rule !== null && matchesRule(rule, facts)) joined.push(collectionId);
      else left.push(collectionId);
    }
    return { joined, left };
  }
}
