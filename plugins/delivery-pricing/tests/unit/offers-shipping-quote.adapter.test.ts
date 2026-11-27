import {
  asOperationContext as asOffersContext,
  type CoreId,
  type ShippingQuoteInput,
  type ShippingQuoteSource,
} from '@cod/plugin-offers';
import { describe, expect, it } from 'vitest';
import { OffersShippingQuoteAdapter } from '../../infrastructure/offers-shipping-quote.adapter';
import { storeKeyOf } from '../fakes/in-memory-fee-groups';
import { ctx, groupInput, quoteWorld, STORE_A1 } from '../support/world';

/** The offers' context for the same (empty) request context the in-memory world uses. */
const offersCtx = asOffersContext({});
const UNRESOLVED = { resolved: false, baseFee: 0, overweightFee: 0, speed: null };

const destination = (fields: Partial<ShippingQuoteInput> = {}): ShippingQuoteInput => ({
  provinceCode: '16',
  stopdesk: false,
  items: [{ productId: '7' as CoreId, variantId: '70' as CoreId, quantity: 1, weightGrams: 7000 }],
  ...fields,
});

/** The adapter over the in-memory quote world: store A1 uses a group charging 50/kg over 5 kg, 600 home in Alger. */
async function adapterWithGroup() {
  const world = quoteWorld();
  const group = await world.saving.create(ctx, STORE_A1, groupInput({ chargeOverweight: true }));
  world.storeDefaults.defaults.set(storeKeyOf(STORE_A1), group.id);
  await world.communes.set(ctx, STORE_A1, group.id, {
    provinceCode: '16',
    rows: [{ codeOns: 1601, homePrice: 750, deskPrice: null, deliveryEnabled: null, deskEnabled: null }],
  });
  const registered: ShippingQuoteSource[] = [];
  const adapter = new OffersShippingQuoteAdapter(world.quotes, { register: (source) => registered.push(source) });
  return { adapter, registered };
}

describe('OffersShippingQuoteAdapter', () => {
  it("registers itself on the offers' shipping quote seam at bootstrap", async () => {
    // Arrange
    const { adapter, registered } = await adapterWithGroup();

    // Act
    adapter.onApplicationBootstrap();

    // Assert
    expect(registered).toEqual([adapter]);
  });

  it("answers the store's fee unwaived, in the offers' shape (the engine applies free delivery, D2414)", async () => {
    // Arrange
    const { adapter } = await adapterWithGroup();

    // Act
    const result = await adapter.quote(offersCtx, STORE_A1, destination());

    // Assert
    expect(result).toEqual({ resolved: true, baseFee: 600, overweightFee: 100, speed: 'standard' });
  });

  it("reads the destination's commune ONS code", async () => {
    // Arrange
    const { adapter } = await adapterWithGroup();

    // Act and Assert
    await expect(adapter.quote(offersCtx, STORE_A1, destination({ townOns: '1601' }))).resolves.toMatchObject({
      resolved: true,
      baseFee: 750,
    });
  });

  it.each(['0', '01601', '1601 ', 'Alger', '1234567', '16-01'])(
    'answers unresolved for the malformed commune %j, never the wilaya price',
    async (townOns) => {
      // Arrange
      const { adapter } = await adapterWithGroup();

      // Act and Assert
      await expect(adapter.quote(offersCtx, STORE_A1, destination({ townOns }))).resolves.toEqual(UNRESOLVED);
    },
  );

  it('answers unresolved for a well-formed commune of another wilaya', async () => {
    // Arrange
    const { adapter } = await adapterWithGroup();

    // Act and Assert
    await expect(adapter.quote(offersCtx, STORE_A1, destination({ townOns: '101' }))).resolves.toEqual(UNRESOLVED);
  });
});
