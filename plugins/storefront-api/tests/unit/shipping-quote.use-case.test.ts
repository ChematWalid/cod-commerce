import type { ShippingQuoteRequest, ShippingQuoteService } from '@cod/plugin-delivery-pricing';
import type { ShippingQuote, StorefrontShippingQuoteBody } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ShippingQuoteUseCase } from '../../application/shipping-quote.use-case';
import type { DeliveryQuotePort } from '../../domain/ports/delivery-quote.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { QuoteRequestInvalidError } from '../../domain/quote-errors';
import type { StoreScope } from '../../domain/store-scope';
import { DeliveryPricingQuoteAdapter } from '../../infrastructure/delivery-quote.adapter';
import { FakeStorefrontStores, STORE_A, STORE_B } from '../fakes/fake-storefront';

const PRODUCT_ID = '12';
const AN_ANSWER: ShippingQuote = {
  baseFee: 500,
  overweightFee: 0,
  totalFee: 500,
  resolved: true,
  speed: 'standard',
  offeredSpeeds: ['standard'],
  freeShipping: false,
  waivedFee: 0,
  source: 'wilaya',
};

/** Records every body the use case passes on, with the scope it names. */
class RecordingDelivery implements DeliveryQuotePort {
  readonly calls: { scope: StoreScope; body: StorefrontShippingQuoteBody }[] = [];

  quote(_ctx: OperationContext, scope: StoreScope, body: StorefrontShippingQuoteBody): Promise<ShippingQuote> {
    this.calls.push({ scope, body });
    return Promise.resolve(AN_ANSWER);
  }
}

function aUseCase() {
  const stores = new FakeStorefrontStores().add(STORE_A).add(STORE_B);
  const delivery = new RecordingDelivery();
  return { useCase: new ShippingQuoteUseCase({ stores, delivery }), delivery, ctx: stores.contextOf(STORE_A) };
}

const aBody = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  provinceCode: '16',
  stopdesk: false,
  items: [{ productId: PRODUCT_ID, quantity: 2 }],
  ...extra,
});

describe('ShippingQuoteUseCase (D3301)', () => {
  it('passes a body asking to waive the fee on without the waiver, and quotes for the context store', async () => {
    // Arrange
    const { useCase, delivery, ctx } = aUseCase();

    // Act
    const answer = await useCase.quote(ctx, aBody({ waive: true, storeId: STORE_B.storeId }));

    // Assert
    expect(answer).toEqual(AN_ANSWER);
    expect(delivery.calls).toEqual([{ scope: STORE_A, body: aBody() }]);
    expect(delivery.calls[0]?.body).not.toHaveProperty('waive');
  });

  it('passes an unknown wilaya code on as sent, for the delivery data to answer', async () => {
    // Arrange
    const { useCase, delivery, ctx } = aUseCase();

    // Act
    await useCase.quote(ctx, aBody({ provinceCode: '99' }));

    // Assert
    expect(delivery.calls[0]?.body.provinceCode).toBe('99');
  });

  it.each([
    ['no body', undefined],
    ['a non-core product id', aBody({ items: [{ productId: 'abc', quantity: 1 }] })],
    ['no lines', aBody({ items: [] })],
    ['a letter commune code', aBody({ townOns: '16a' })],
  ])('refuses %s with the shared pricing code and never asks the port', async (_label, raw) => {
    // Arrange
    const { useCase, delivery, ctx } = aUseCase();

    // Act
    const refusal = useCase.quote(ctx, raw);

    // Assert
    await expect(refusal).rejects.toEqual(new QuoteRequestInvalidError('pricing.invalid-request'));
    await expect(refusal).rejects.toMatchObject({ code: 'pricing.invalid-request' });
    expect(delivery.calls).toEqual([]);
  });
});

/** A delivery service stand-in that records the request it is asked. */
function recordingService(): { service: ShippingQuoteService; requests: ShippingQuoteRequest[] } {
  const requests: ShippingQuoteRequest[] = [];
  const service = {
    quote: (_ctx: unknown, _scope: unknown, request: ShippingQuoteRequest) => {
      requests.push(request);
      return Promise.resolve(AN_ANSWER);
    },
  } as unknown as ShippingQuoteService;
  return { service, requests };
}

describe('DeliveryPricingQuoteAdapter (D3301)', () => {
  it('turns the commune code text into its number and never sets a waiver', async () => {
    // Arrange
    const { service, requests } = recordingService();
    const body = { ...aBody({ townOns: '1601' }), waive: true } as unknown as StorefrontShippingQuoteBody;
    const ctx = new FakeStorefrontStores().add(STORE_A).contextOf(STORE_A);

    // Act
    await new DeliveryPricingQuoteAdapter(service).quote(ctx, STORE_A, body);

    // Assert
    expect(requests).toEqual([
      { provinceCode: '16', townOns: 1601, stopdesk: false, items: [{ productId: PRODUCT_ID, quantity: 2 }] },
    ]);
  });

  it('names no commune when the body names none', async () => {
    // Arrange
    const { service, requests } = recordingService();
    const ctx = new FakeStorefrontStores().add(STORE_A).contextOf(STORE_A);

    // Act
    await new DeliveryPricingQuoteAdapter(service).quote(ctx, STORE_A, aBody() as StorefrontShippingQuoteBody);

    // Assert
    expect(requests[0]).not.toHaveProperty('townOns');
    expect(requests[0]).not.toHaveProperty('waive');
  });
});
