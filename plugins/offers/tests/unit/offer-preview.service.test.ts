import { offerInputSchema, type OfferInput, type OfferPreviewInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { OfferPreviewService, type OfferPreviewPorts } from '../../application/offer-preview.service';
import { PREVIEW_ADDON_PLACEMENT, PREVIEW_OFFER_ID } from '../../domain/constants';
import { priceCart } from '../../domain/engine/pipeline';
import { previewSnapshot } from '../../domain/engine/preview-snapshot';
import { InvalidOfferConfigError, InvalidQuoteRequestError, NoActiveStoreError } from '../../domain/errors';
import { FakeActiveStores } from '../fakes/fake-active-stores';
import { T0 } from '../support/builders';
import { scopeA, scopeB } from '../support/offer-records';
import { REGISTRY, TIERS_2_AND_3 } from '../support/pipeline';

const stores = new FakeActiveStores();
const ctx = stores.contextOf(scopeA);
const PORTS: OfferPreviewPorts = { stores, kinds: REGISTRY, clock: { now: () => T0 } };
const PRODUCT_1 = [{ role: 'buy' as const, refType: 'product' as const, refId: '1' }];
const TEN_PERCENT = { valueType: 'percent', value: 10, appliesTo: 'targets' };

/** A preview request of a draft on product 1, changed by `offer`, at the default sample price and fee. */
const aPreview = (offer: Partial<OfferInput> = {}): OfferPreviewInput => ({
  offer: { kind: 'quantity', title: 'Buy more', config: TIERS_2_AND_3, targets: PRODUCT_1, ...offer },
});

const preview = (input: OfferPreviewInput) => new OfferPreviewService(PORTS).preview(ctx, scopeA, input);

describe('OfferPreviewService (D2516)', () => {
  it('prices every tier of a quantity draft at the sample price', async () => {
    // Arrange
    const input = aPreview();
    const command = offerInputSchema.parse(input.offer);
    const draft = { command, addonPlacement: PREVIEW_ADDON_PLACEMENT };
    const twoPieces = previewSnapshot(
      draft,
      { pieces: 2, withGet: false, withAddon: false },
      {
        price: 4_900,
        deliveryFee: 800,
        now: T0,
      },
    );

    // Act
    const { scenarios, warnings } = await preview(input);

    // Assert
    expect(scenarios.map(({ pieces, quote }) => ({ pieces, total: quote.total }))).toEqual([
      { pieces: 1, total: 5_700 },
      { pieces: 2, total: 9_620 },
      { pieces: 3, total: 12_495 },
    ]);
    expect(scenarios[0]?.quote.nudge).toMatchObject({ offerId: PREVIEW_OFFER_ID, units: 1, saving: 980 });
    expect(scenarios[1]?.quote).toEqual(expect.objectContaining(priceCartParts(twoPieces)));
    expect(warnings).toEqual([]);
  });

  it('previews buy 2 get 1 with a gift line at 0', async () => {
    // Arrange
    const config = { appliesTo: 'targets', buyQuantity: 2, getQuantity: 1, getFrom: 'same', gift: { mode: 'free' } };

    // Act
    const { scenarios } = await preview(aPreview({ kind: 'bxgy', config }));

    // Assert
    expect(scenarios).toHaveLength(1);
    const [scenario] = scenarios;
    expect(scenario?.pieces).toBe(3);
    expect(scenario?.quote.lines.find((line) => line.giftOf === PREVIEW_OFFER_ID)).toMatchObject({
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    });
    expect(scenario?.quote.total).toBe(9_800 + 800);
  });

  it('previews an add-on accepted', async () => {
    // Arrange
    const config = { condition: 'any_order', price: { mode: 'fixed', value: 1_200 }, maxPiecesPerOrder: 3 };
    const offer = {
      kind: 'addon',
      config: { ...config, placement: 'thank_you' },
      targets: [{ role: 'addon' as const, refType: 'variant' as const, refId: '21' }],
    };

    // Act
    const { scenarios } = await preview(aPreview(offer));

    // Assert
    expect(scenarios.map(({ pieces, addonAccepted }) => ({ pieces, addonAccepted }))).toEqual([
      { pieces: 1, addonAccepted: true },
    ]);
    expect(scenarios[0]?.quote.lines.find((line) => line.addonOf === PREVIEW_OFFER_ID)).toMatchObject({
      variantId: '21',
      unitPrice: 1_200,
    });
    expect(scenarios[0]?.quote.total).toBe(4_900 + 1_200 + 800);
  });

  it('previews a codes offer as applied', async () => {
    // Arrange
    const input = aPreview({ kind: 'product_discount', method: 'codes', config: TEN_PERCENT });

    // Act
    const { scenarios } = await preview(input);

    // Assert
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.quote.lines[0]).toMatchObject({ unitPrice: 4_410 });
    expect(scenarios[0]?.quote.total).toBe(4_410 + 800);
  });

  it('previews a draft limited to order_form_app', async () => {
    // Arrange
    const input = aPreview({
      kind: 'product_discount',
      config: TEN_PERCENT,
      eligibility: { channels: ['order_form_app'] },
    });

    // Act
    const { scenarios } = await preview(input);

    // Assert
    expect(scenarios[0]?.quote.savings).toBe(490);
  });

  it('warns when a tier total is not divisible by its quantity', async () => {
    // Arrange
    const config = { priceMode: 'total', tiers: [{ quantity: 3, price: 10_000 }] };

    // Act
    const { scenarios, warnings } = await preview(aPreview({ config }));

    // Assert
    expect(warnings).toEqual(['tier_total_not_divisible']);
    expect(scenarios.map(({ pieces }) => pieces)).toEqual([1, 3]);
  });

  it('refuses a sample price of 0', async () => {
    // Arrange
    const input = { ...aPreview(), samplePrice: 0 };

    // Act
    const result = preview(input);

    // Assert
    await expect(result).rejects.toBeInstanceOf(InvalidQuoteRequestError);
  });

  it('refuses a draft whose config fails its schema', async () => {
    // Arrange
    const input = aPreview({ config: { priceMode: 'percent', tiers: [] } });

    // Act
    const result = preview(input);

    // Assert
    await expect(result).rejects.toBeInstanceOf(InvalidOfferConfigError);
  });

  it('refuses a draft whose offer fields fail the input schema', async () => {
    // Arrange
    const input = aPreview({ title: '   ' });

    // Act
    const result = preview(input);

    // Assert
    await expect(result).rejects.toBeInstanceOf(InvalidOfferConfigError);
  });

  it("refuses a ctx on another store's channel", async () => {
    // Arrange
    const service = new OfferPreviewService(PORTS);

    // Act
    const result = service.preview(ctx, scopeB, aPreview());

    // Assert
    await expect(result).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('reads no repository', async () => {
    // Arrange
    const throwing = new Proxy(
      {},
      {
        get: () => {
          throw new Error('the preview read a repository');
        },
      },
    );
    const service = new OfferPreviewService({ ...PORTS, offers: throwing, codes: throwing } as OfferPreviewPorts);

    // Act
    const result = await service.preview(ctx, scopeA, aPreview());

    // Assert
    expect(result.scenarios).toHaveLength(3);
  });
});

/** The quote parts a preview shows, priced by the engine on `prepared`. */
function priceCartParts(prepared: ReturnType<typeof previewSnapshot>) {
  const { lines, subtotal, discountTotal, delivery, total, savings, nudge, suggestions } = priceCart({
    registry: REGISTRY,
    ...prepared,
  });
  return { lines, subtotal, discountTotal, delivery, total, savings, nudge, suggestions };
}
