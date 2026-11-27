import { randomInt } from 'node:crypto';
import { asOperationContext, DeliveryDefaultsConvergeService } from '@cod/plugin-delivery-pricing';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { shippingQuoteSchema } from '@cod/shared';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type MadeProduct, type RestAnswer, storefrontSuite } from './storefront-kit';

const suite = storefrontSuite(944, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const PATH = '/store/shipping-quote';
const ALGER = '16';
const ALGER_CENTRE = '1601';
const COMMUNE_HOME = 777;
/** A parcel over the group's allowance: two pieces of 3.5 kg against 5 kg, two started kilograms. */
const HEAVY_GRAMS = 3500;
const ALLOWANCE_KG = 5;
const RATE_PER_KG = 50;
const QUOTE_IP_CAPACITY = 120;
/** Calls past the capacity a burst may make before its refusal: the bucket refills two tokens a second meanwhile. */
const REFILL_MARGIN = 30;
/** A product id no store holds. */
const UNKNOWN_PRODUCT = '987654321';

const RATE_FIELDS = 'provinceCode homePrice deskPrice deliveryEnabled deskEnabled';
const GROUP = `query ($id: String!) { deliveryFeeGroup(id: $id) { name carrierId rates { ${RATE_FIELDS} } } }`;
const UPDATE_GROUP = `mutation ($id: String!, $input: DeliveryFeeGroupInput!) {
  updateDeliveryFeeGroup(id: $id, input: $input) { id }
}`;
const SET_COMMUNES = `mutation ($groupId: String!, $provinceCode: String!, $rows: [DeliveryFeeCommuneRateInput!]!) {
  setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: $provinceCode, rows: $rows) { id }
}`;

/** One wilaya row of a fee group, as the server answers and takes it. */
interface Rate {
  readonly provinceCode: string;
  readonly homePrice: number;
  readonly deskPrice: number;
  readonly deliveryEnabled: boolean;
  readonly deskEnabled: boolean;
}

const held = {} as { aRates: readonly Rate[]; aHeavy: MadeProduct; bHeavy: MadeProduct; undelivered: string };

async function defaultGroupOf(store: StoreFixture): Promise<string> {
  const [row] = await suite.kit.query<{ id: string | null }>(
    'SELECT "defaultDeliveryFeeGroupId" AS id FROM "store" WHERE id = $1',
    [store.id],
  );
  if (row?.id == null) throw new Error(`store ${store.id} has no default fee group`);
  return row.id;
}

/** Rewrites `store`'s default group from its own rows, changed by `change`, charging overweight. */
async function rewriteGroup(business: BusinessFixture, store: StoreFixture, change: (rates: Rate[]) => Rate[]) {
  await suite.kit.asOwner(business, store);
  const id = await defaultGroupOf(store);
  const { deliveryFeeGroup } = await suite.kit.gql<{ deliveryFeeGroup: { name: string; rates: Rate[] } }>(GROUP, {
    id,
  });
  const rates = change(deliveryFeeGroup.rates);
  const input = {
    name: deliveryFeeGroup.name,
    carrierId: null,
    chargeOverweight: true,
    overweightAllowanceKg: ALLOWANCE_KG,
    overweightRate: RATE_PER_KG,
    rates,
  };
  await suite.kit.gql(UPDATE_GROUP, { id, input });
  return { id, rates };
}

const rateOf = (code: string): Rate => {
  const rate = held.aRates.find((row) => row.provinceCode === code);
  if (rate === undefined) throw new Error(`no rate for ${code}`);
  return rate;
};

const quoteBody = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  provinceCode: ALGER,
  stopdesk: false,
  items: [{ productId: held.aHeavy.id, quantity: 1 }],
  ...extra,
});

const aStore = (): string => suite.fixtures.a.stores[0].id;
const quote = (body: unknown, storeId: string | undefined = aStore(), clientIp?: string): Promise<RestAnswer> =>
  suite.kit.store(PATH, storeId, { method: 'POST', body, ...(clientIp === undefined ? {} : { clientIp }) });

/** A documentation address (TEST-NET-3) of its own per run, so a rerun within a minute finds a full bucket. */
const aBuyerIp = (): string => `203.0.113.${String(randomInt(1, 255))}`;

beforeAll(async () => {
  const { kit, fixtures } = suite;
  const ctx = await kit.app.get(RequestContextService).create({ apiType: 'admin' });
  await kit.app.get(DeliveryDefaultsConvergeService).convergeAll(asOperationContext(ctx));
  const { a, b } = fixtures;
  await kit.asOwner(b);
  held.bHeavy = await kit.product('Quote heavy B', { weight: HEAVY_GRAMS });
  const rewritten = await rewriteGroup(a, a.stores[0], (rates) => rates);
  held.aRates = rewritten.rates;
  held.aHeavy = await kit.product('Quote heavy A', { weight: HEAVY_GRAMS });
  await kit.gql(SET_COMMUNES, {
    groupId: rewritten.id,
    provinceCode: ALGER,
    rows: [
      {
        codeOns: Number(ALGER_CENTRE),
        homePrice: COMMUNE_HOME,
        deskPrice: null,
        deliveryEnabled: null,
        deskEnabled: null,
      },
    ],
  });
  const other = await rewriteGroup(a, a.stores[1], (rates) =>
    rates.map((rate, index) => (index === 0 ? { ...rate, deliveryEnabled: false } : rate)),
  );
  held.undelivered = other.rates[0]?.provinceCode ?? '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /store/shipping-quote (D3301)', () => {
  it("answers the store's home and desk fee of a wilaya, uncached, in the shared shape", async () => {
    // Act
    const home = await quote(quoteBody());
    const desk = await quote(quoteBody({ stopdesk: true }));

    // Assert
    expect(home.status).toBe(200);
    expect(shippingQuoteSchema.parse(home.body)).toMatchObject({
      resolved: true,
      baseFee: rateOf(ALGER).homePrice,
      totalFee: rateOf(ALGER).homePrice,
      source: 'wilaya',
    });
    expect(desk.body).toMatchObject({ resolved: true, baseFee: rateOf(ALGER).deskPrice });
    expect(home.cacheControl).toBe('private, no-store');
  });

  it("prices a commune with its own row's price and says so", async () => {
    // Act
    const answer = await quote(quoteBody({ townOns: ALGER_CENTRE }));

    // Assert
    expect(answer.body).toMatchObject({ resolved: true, baseFee: COMMUNE_HOME, source: 'commune' });
  });

  it('answers an undelivered or unknown wilaya unresolved with zero fees, not an error', async () => {
    // Act
    const undelivered = await quote(quoteBody({ provinceCode: held.undelivered }), suite.fixtures.a.stores[1].id);
    const unknown = await quote(quoteBody({ provinceCode: '99' }));

    // Assert
    for (const answer of [undelivered, unknown]) {
      expect(answer.status).toBe(200);
      expect(answer.body).toMatchObject({ resolved: false, baseFee: 0, totalFee: 0, source: null });
    }
  });

  it('never waives the fee a body asks to waive', async () => {
    // Act
    const answer = await quote(quoteBody({ waive: true }));

    // Assert
    expect(answer.body).toMatchObject({ totalFee: rateOf(ALGER).homePrice, waivedFee: 0, freeShipping: false });
  });

  it("charges overweight on the store's own product and reads another store's product like an unknown one", async () => {
    // Act
    const own = await quote(quoteBody({ items: [{ productId: held.aHeavy.id, quantity: 2 }] }));
    const foreign = await quote(quoteBody({ items: [{ productId: held.bHeavy.id, quantity: 2 }] }));
    const unknown = await quote(quoteBody({ items: [{ productId: UNKNOWN_PRODUCT, quantity: 2 }] }));

    // Assert
    expect(own.body).toMatchObject({ overweightFee: 2 * RATE_PER_KG });
    expect(foreign.body).toMatchObject({ overweightFee: 0 });
    expect(foreign.text).toBe(unknown.text);
  });

  it('answers an unsigned call with an empty 404', async () => {
    // Act
    const answer = await suite.kit.store(PATH, undefined, { method: 'POST', body: quoteBody() });

    // Assert
    expect(answer).toMatchObject({ status: 404, text: '' });
  });

  it.each([
    ['a non-core product id', { items: [{ productId: 'abc', quantity: 1 }] }],
    ['a zero quantity', { items: [{ productId: '12', quantity: 0 }] }],
    ['no delivery method', { stopdesk: 'yes' }],
  ])('refuses %s with 400 and only the shared code, uncached', async (_label, extra) => {
    // Act
    const answer = await quote(quoteBody(extra));

    // Assert
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({ code: 'pricing.invalid-request' });
    expect(answer.cacheControl).toBe('private, no-store');
  });
});

describe('POST /store/shipping-quote rate limit (D3302)', () => {
  it('serves 120 quotes of one buyer address within a minute, then refuses them', async () => {
    // Arrange: refused bodies spend tokens too, and cost no pricing.
    const ip = aBuyerIp();
    const statuses: number[] = [];

    // Act
    while (statuses.length < QUOTE_IP_CAPACITY + REFILL_MARGIN && !statuses.includes(429)) {
      statuses.push((await quote({}, aStore(), ip)).status);
    }

    // Assert
    expect(statuses.slice(0, QUOTE_IP_CAPACITY).every((status) => status === 400)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('keys a signed quote that names no buyer by its store under the store bucket', async () => {
    // Arrange
    const consume = vi.spyOn(suite.kit.app.get(RateLimiter), 'consume');

    // Act
    await quote(quoteBody());

    // Assert
    expect(consume).toHaveBeenCalledWith('storefront-quote-store', `internal:test:${aStore()}`);
  });
});
