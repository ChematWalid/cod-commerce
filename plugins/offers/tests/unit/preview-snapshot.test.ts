import { offerInputSchema, type OfferInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { PREVIEW_CODE, PREVIEW_OFFER_ID } from '../../domain/constants';
import { previewSnapshot, type PreviewSample } from '../../domain/engine/preview-snapshot';
import { T0 } from '../support/builders';

const SAMPLE: PreviewSample = { price: 4_900, deliveryFee: 800, now: T0 };
const ONE_PIECE = { pieces: 1, withGet: false, withAddon: false } as const;

/** A draft as the admin input schema outputs it, offered on the order form. */
const aDraft = (input: Partial<OfferInput> = {}) => ({
  command: offerInputSchema.parse({ kind: 'quantity', title: 'Buy more', config: {}, ...input }),
  addonPlacement: 'order_form' as const,
});

describe('previewSnapshot (D2516)', () => {
  it('holds the draft as one active offer without schedule, limits or audience', () => {
    // Arrange
    const draft = aDraft({
      eligibility: { audience: 'first', channels: ['landing_page'], wilayas: ['16'], deliveryMethods: ['desk'] },
      totalUsageLimit: 5,
      perBuyerLimit: 1,
      startsAt: '2030-01-01T00:00:00.000Z',
      endsAt: '2030-02-01T00:00:00.000Z',
    });

    // Act
    const { snapshot } = previewSnapshot(draft, ONE_PIECE, SAMPLE);

    // Assert
    expect(snapshot.offers).toHaveLength(1);
    expect(snapshot.offers[0]).toMatchObject({
      id: PREVIEW_OFFER_ID,
      status: 'active',
      startsAt: null,
      endsAt: null,
      totalUsageLimit: null,
      perBuyerLimit: null,
      usageCount: 0,
      eligibility: { audience: 'everyone', channels: ['landing_page'], wilayas: [], deliveryMethods: [] },
    });
    expect(snapshot.now).toBe(T0);
    expect(snapshot.shipping).toEqual({ resolved: true, baseFee: 800, overweightFee: 0, speed: null });
  });

  it("names the buy line after the draft's first buy target, at the sample price", () => {
    // Arrange
    const draft = aDraft({
      targets: [
        { role: 'buy', refType: 'variant', refId: '11' },
        { role: 'buy', refType: 'product', refId: '2' },
      ],
    });

    // Act
    const { cart } = previewSnapshot(draft, { ...ONE_PIECE, pieces: 3 }, SAMPLE);

    // Assert
    expect(cart.lines).toEqual([expect.objectContaining({ variantId: '11', quantity: 3, originalPrice: 4_900 })]);
  });

  it('uses synthetic ids when the draft has no buy target, and a collection target as the line collection', () => {
    // Arrange
    const untargeted = aDraft();
    const byCollection = aDraft({ targets: [{ role: 'buy', refType: 'collection', refId: '5' }] });

    // Act
    const [plain] = previewSnapshot(untargeted, ONE_PIECE, SAMPLE).cart.lines;
    const [collected] = previewSnapshot(byCollection, ONE_PIECE, SAMPLE).cart.lines;

    // Assert
    expect(plain?.productId).toMatch(/^preview-/);
    expect(plain?.variantId).toMatch(/^preview-/);
    expect(plain?.collectionIds).toEqual([]);
    expect(collected?.collectionIds).toEqual(['5']);
  });

  it('splits the get pieces onto a line named by the first get target', () => {
    // Arrange
    const draft = aDraft({
      kind: 'bxgy',
      targets: [
        { role: 'buy', refType: 'product', refId: '1' },
        { role: 'get', refType: 'product', refId: '2' },
      ],
    });

    // Act
    const { cart } = previewSnapshot(draft, { pieces: 5, withGet: true, getPieces: 2, withAddon: false }, SAMPLE);

    // Assert
    expect(cart.lines.map(({ productId, quantity }) => ({ productId, quantity }))).toEqual([
      { productId: '1', quantity: 3 },
      { productId: '2', quantity: 2 },
    ]);
  });

  it("accepts one piece of the first add-on target, at the sample price, on the draft's placement", () => {
    // Arrange
    const draft = {
      ...aDraft({ kind: 'addon', targets: [{ role: 'addon', refType: 'variant', refId: '21' }] }),
      addonPlacement: 'thank_you' as const,
    };

    // Act
    const { cart } = previewSnapshot(draft, { ...ONE_PIECE, withAddon: true }, SAMPLE);

    // Assert
    expect(cart.addons).toEqual([
      {
        offerId: PREVIEW_OFFER_ID,
        variantId: '21',
        quantity: 1,
        priced: { productId: expect.stringMatching(/^preview-/) as unknown, originalPrice: 4_900, collectionIds: [] },
      },
    ]);
    expect(cart.addonPlacement).toBe('thank_you');
  });

  it('activates a codes offer with a synthetic code', () => {
    // Arrange
    const draft = aDraft({ method: 'codes' });

    // Act
    const { snapshot, cart } = previewSnapshot(draft, ONE_PIECE, SAMPLE);

    // Assert
    expect(cart.codes).toEqual([PREVIEW_CODE]);
    expect(snapshot.codes.get(PREVIEW_CODE)).toEqual({ offerId: PREVIEW_OFFER_ID, usageLimit: null, usageCount: 0 });
  });

  it('prices on the first allowed channel, and on the storefront when every channel is allowed', () => {
    // Arrange
    const limited = aDraft({ eligibility: { channels: ['order_form_app', 'storefront'] } });
    const everywhere = aDraft();

    // Act
    const limitedCart = previewSnapshot(limited, ONE_PIECE, SAMPLE).cart;
    const everywhereCart = previewSnapshot(everywhere, ONE_PIECE, SAMPLE).cart;

    // Assert
    expect(limitedCart).toMatchObject({ channel: 'order_form_app', destination: null, buyer: null, codes: [] });
    expect(everywhereCart.channel).toBe('storefront');
  });
});
