import { COLLECTIONS_ERROR_CODES, type CollectionRule, NORMAL_FORM_VERSION } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateCollectionService } from '../../application/create-collection.service';
import { UpdateCollectionService } from '../../application/update-collection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { scopeA } from '../support/builders';
import { facts, PROMO_TAG, priceBetween, ruleOf, tagIs } from './rule-fixtures';

const ctx = asOperationContext({});
const PROMO_RULE = ruleOf('all', tagIs('is_any_of', PROMO_TAG));
const CHEAP_RULE = ruleOf('all', priceBetween(0, 1_000));

let world: FakeCollectionWorld;
let update: UpdateCollectionService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  update = new UpdateCollectionService(world.ports);
  world.facts.put(scopeA, facts({ productId: '1', tagIds: [PROMO_TAG], price: 900 }));
  world.facts.put(scopeA, facts({ productId: '2', tagIds: [PROMO_TAG], price: 3_000 }));
  world.facts.put(scopeA, facts({ productId: '3', price: 500 }));
});

/** A collection of store A made through the create use case; automatic when a rule is given. */
async function collection(rule?: CollectionRule): Promise<string> {
  const view = await new CreateCollectionService(world.ports).create(ctx, scopeA, {
    title: 'Rules',
    slug: `rules-${String(Math.random()).slice(2)}`,
    visible: true,
    position: 0,
    mode: rule === undefined ? 'manual' : 'automatic',
    rule,
  });
  return view.id;
}

const memberIds = async (collectionId: string): Promise<string[]> =>
  (await world.tables.members.membersOf(ctx, scopeA, collectionId)).map((member) => member.productId);

describe('rule saves recompute membership (D2302, D2312)', () => {
  it('editing the rule rebuilds the members at save and publishes updated then membership', async () => {
    // Arrange
    const id = await collection(PROMO_RULE);
    world.events.published.length = 0;

    // Act
    const view = await update.update(ctx, scopeA, id, { rule: CHEAP_RULE });

    // Assert
    expect(await memberIds(id)).toEqual(['3', '1']);
    expect(view).toMatchObject({ rule: CHEAP_RULE, productCount: 2 });
    expect(world.events.published.map((event) => event.change)).toEqual(['updated', 'membership']);
  });

  it('switching manual to automatic replaces the hand-picked members with the matches', async () => {
    // Arrange
    const id = await collection();
    await world.tables.members.replaceMembers(ctx, scopeA, id, [{ productId: '3', position: 0 }]);

    // Act
    const view = await update.update(ctx, scopeA, id, { mode: 'automatic', rule: PROMO_RULE });

    // Assert
    expect(view.mode).toBe('automatic');
    expect(await memberIds(id)).toEqual(['2', '1']);
    const stored = await world.tables.definitions.findByCollectionId(ctx, scopeA, id);
    expect(stored).toMatchObject({ mode: 'automatic', rule: PROMO_RULE, matchVersion: NORMAL_FORM_VERSION });
  });

  it('switching automatic to manual keeps the members in their order as the manual list', async () => {
    // Arrange
    const id = await collection(PROMO_RULE);

    // Act
    const view = await update.update(ctx, scopeA, id, { mode: 'manual' });

    // Assert
    expect(view).toMatchObject({ mode: 'manual', rule: null });
    expect(await world.tables.members.membersOf(ctx, scopeA, id)).toEqual([
      { productId: '2', position: 0 },
      { productId: '1', position: 1 },
    ]);
  });

  it('a save of the same rule or of the title alone keeps the members without walking the store', async () => {
    // Arrange
    const id = await collection(PROMO_RULE);
    world.facts.put(scopeA, facts({ productId: '4', tagIds: [PROMO_TAG] }));
    world.facts.pageRequests.length = 0;

    // Act
    await update.update(ctx, scopeA, id, { mode: 'automatic', rule: PROMO_RULE });
    await update.update(ctx, scopeA, id, { title: 'Renamed' });

    // Assert
    expect(world.facts.pageRequests).toEqual([]);
    expect(await memberIds(id)).toEqual(['2', '1']);
  });

  it('refuses a switch to automatic without a rule and a rule on a manual collection', async () => {
    // Arrange
    const id = await collection();

    // Act
    const noRule = update.update(ctx, scopeA, id, { mode: 'automatic' });
    const ruleOnManual = update.update(ctx, scopeA, id, { rule: PROMO_RULE });

    // Assert
    await expect(noRule).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.RULE_INVALID });
    await expect(ruleOnManual).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.INVALID_INPUT });
  });
});
