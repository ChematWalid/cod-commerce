import { type OfferInput, STAGE_DELIVERY } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { OfferKindCalculator } from '../../domain/engine/kind-registry';
import { InvalidOfferTargetsError } from '../../domain/errors';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA } from '../support/offer-records';

const ctx = asOperationContext({});

/** A valid order discount: 300 DZD off the order, with no target. */
const ORDER_DISCOUNT_INPUT: OfferInput = {
  kind: 'order_discount',
  title: 'Order discount',
  config: { valueType: 'fixed', value: 300 },
};

/** One buy target on every existing kind, each with a config its schema accepts. */
const BUY_TARGET_INPUTS: readonly OfferInput[] = [
  QUANTITY_INPUT,
  {
    kind: 'product_discount',
    title: 'Product discount',
    config: { valueType: 'percent', value: 10, appliesTo: 'targets' },
    targets: [{ role: 'buy', refType: 'product', refId: '3' }],
  },
  { ...ORDER_DISCOUNT_INPUT, targets: [{ role: 'buy', refType: 'variant', refId: '11' }] },
  {
    kind: 'free_delivery',
    title: 'Free delivery',
    config: {},
    targets: [{ role: 'buy', refType: 'collection', refId: '5' }],
  },
];

/** A test-only kind that allows buy and get targets, so a kind change can drop `get` from the allowed roles. */
const GIFT_KIND: OfferKindCalculator<unknown> = {
  kind: 'test_gift',
  combinationClass: 'delivery',
  stage: STAGE_DELIVERY,
  configSchema: z.object({}),
  evaluate: () => ({ kind: 'delivery', value: 0 }),
  targetRules: () => ({ allowed: ['buy', 'get'], required: [] }),
};

/** A test kind whose schema counts how often it parses a config, and its counter. */
function countingKind(): { readonly calculator: OfferKindCalculator<unknown>; readonly parses: () => number } {
  let parses = 0;
  const calculator: OfferKindCalculator<unknown> = {
    ...GIFT_KIND,
    kind: 'test_counting',
    configSchema: z.object({}).transform((config) => {
      parses += 1;
      return config;
    }),
  };
  return { calculator, parses: () => parses };
}

describe('OfferAdminService target roles (D2501)', () => {
  it('refuses a get target on a quantity offer', async () => {
    // Arrange
    const { service, tables } = setUpOfferAdmin();
    const input: OfferInput = {
      ...QUANTITY_INPUT,
      targets: [...(QUANTITY_INPUT.targets ?? []), { role: 'get', refType: 'variant', refId: '12' }],
    };

    // Act
    const creating = service.createDraft(ctx, scopeA, input);

    // Assert
    await expect(creating).rejects.toBeInstanceOf(InvalidOfferTargetsError);
    expect(tables.offerRows).toEqual([]);
  });

  it('refuses an addon target on an order discount', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, ORDER_DISCOUNT_INPUT);

    // Act
    const editing = service.update(ctx, scopeA, draft.id, {
      targets: [{ role: 'addon', refType: 'variant', refId: '21' }],
    });

    // Assert
    await expect(editing).rejects.toMatchObject({ code: 'offers.invalid-targets' });
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ targets: [], version: 1 });
  });

  it('refuses a get target in an update that also changes the kind', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const editing = service.update(ctx, scopeA, draft.id, {
      ...ORDER_DISCOUNT_INPUT,
      targets: [{ role: 'get', refType: 'product', refId: '3' }],
    });

    // Assert
    await expect(editing).rejects.toBeInstanceOf(InvalidOfferTargetsError);
  });

  it('refuses a kind change that keeps a stored target the new kind does not allow', async () => {
    // Arrange
    const { service } = setUpOfferAdmin({ calculators: [...BUILT_IN_OFFER_KINDS, GIFT_KIND] });
    const draft = await service.createDraft(ctx, scopeA, {
      kind: GIFT_KIND.kind,
      title: 'Gift',
      config: {},
      targets: [{ role: 'get', refType: 'variant', refId: '12' }],
    });

    // Act
    const editing = service.update(ctx, scopeA, draft.id, {
      kind: ORDER_DISCOUNT_INPUT.kind,
      config: ORDER_DISCOUNT_INPUT.config,
    });

    // Assert
    await expect(editing).rejects.toBeInstanceOf(InvalidOfferTargetsError);
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ kind: GIFT_KIND.kind, version: 1 });
  });

  it('parses the kind config once per write', async () => {
    // Arrange
    const counting = countingKind();
    const { service } = setUpOfferAdmin({ calculators: [counting.calculator] });

    // Act
    await service.createDraft(ctx, scopeA, { kind: counting.calculator.kind, title: 'Counted', config: {} });

    // Assert
    expect(counting.parses()).toBe(1);
  });

  it('accepts buy targets on every existing kind', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const drafts = await Promise.all(BUY_TARGET_INPUTS.map((input) => service.createDraft(ctx, scopeA, input)));

    // Assert
    expect(drafts.map((draft) => draft.targets.map((target) => target.role))).toEqual([
      ['buy'],
      ['buy'],
      ['buy'],
      ['buy'],
    ]);
  });

  it('keeps a draft without its required targets: required roles are checked at publish', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const draft = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, targets: [] });

    // Assert
    expect(draft).toMatchObject({ status: 'draft', targets: [] });
  });
});
