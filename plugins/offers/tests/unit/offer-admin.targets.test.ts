import type { OfferInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidOfferTargetsError } from '../../domain/errors';
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

  it('refuses a kind change that leaves a target its new kind does not allow', async () => {
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
