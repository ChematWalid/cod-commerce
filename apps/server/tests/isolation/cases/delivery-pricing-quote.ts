import type { INestApplicationContext } from '@nestjs/common';
import {
  asOperationContext,
  type DeliveryStoreScope,
  type ShippingQuoteRequest,
  ShippingQuoteService,
} from '@cod/plugin-delivery-pricing';
import { GEO_ERROR_CODES, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { ALGER, ALGER_CENTRE } from '../delivery-pricing-operations';
import { deliveryPricingOf } from '../delivery-pricing-rows';
import type { BusinessWorld, World } from '../world-types';

/** A signed storefront answer: its status and parsed body. */
export interface SignedAnswer {
  readonly status: number;
  readonly body: string;
}

/**
 * What the delivery-pricing rows need from the controller: the seeded world, the booted server, and a signed `GET`
 * (D112) whose signature covers `signedStoreId` as the store header (D3135).
 */
export interface DeliveryPricingHarness {
  readonly world: () => World;
  readonly app: () => INestApplicationContext;
  readonly signedGet: (path: string, signedStoreId: string) => Promise<SignedAnswer>;
}

type Pair = readonly [
  label: string,
  attacker: (world: World) => BusinessWorld,
  victim: (world: World) => BusinessWorld,
];
const PAIRS: readonly Pair[] = [
  ['A', (world) => world.a, (world) => world.b],
  ['B', (world) => world.b, (world) => world.a],
];

const NOT_FOUND = 404;
const OK = 200;

/** `business`'s first store as delivery pricing scopes it. */
const firstStoreScope = (business: BusinessWorld): DeliveryStoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(toSnowflake(business.stores[0].id)),
});

/** A delivery quote of an empty cart to Alger on `business`'s first store, through the service P3.S3 calls. */
async function quoteIn(app: INestApplicationContext, business: BusinessWorld, request: Partial<ShippingQuoteRequest>) {
  const ctx = await app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: business.stores[0].channelToken });
  return app.get(ShippingQuoteService).quote(asOperationContext(ctx), firstStoreScope(business), {
    provinceCode: ALGER,
    stopdesk: false,
    items: [],
    ...request,
  });
}

/**
 * The delivery-pricing rows of the P3 isolation suite that the HTTP matrix cannot hold: each business's quote prices
 * with its own default group only, even when its store row points at the other business's group (a dangling id from
 * before #230), and the signed storefront route refuses another store's id under a store's signed header (D3135).
 */
export function describeDeliveryPricingIsolation({ world, app, signedGet }: DeliveryPricingHarness): void {
  const sql = () => app().get(TransactionalConnection).rawConnection;

  describe('delivery pricing: a store quotes and narrows with its own fee table only', () => {
    it.each(PAIRS)("quotes %s's first store with its own default group", async (_label, attackerOf, victimOf) => {
      const [attacker, victim] = [attackerOf(world()), victimOf(world())];
      const own = deliveryPricingOf(attacker);

      const wilaya = await quoteIn(app(), attacker, {});
      const commune = await quoteIn(app(), attacker, { townOns: ALGER_CENTRE });

      expect(wilaya).toMatchObject({ resolved: true, baseFee: own.homePrice, source: 'wilaya' });
      expect(commune).toMatchObject({ resolved: true, baseFee: own.communeHomePrice, source: 'commune' });
      expect([wilaya.baseFee, commune.baseFee]).not.toContain(deliveryPricingOf(victim).homePrice);
    });

    it.each(PAIRS)(
      "never reads the other business's group when %s's store row points at it",
      async (_label, attackerOf, victimOf) => {
        const [attacker, victim] = [attackerOf(world()), victimOf(world())];
        const store = attacker.stores[0].id;
        const setDefault = (groupId: string) =>
          sql().query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE "id" = $2', [groupId, store]);
        await setDefault(deliveryPricingOf(victim).groupId);

        try {
          const quote = await quoteIn(app(), attacker, { townOns: ALGER_CENTRE });

          expect(quote).toMatchObject({ resolved: false, baseFee: 0, totalFee: 0, source: null });
        } finally {
          await setDefault(deliveryPricingOf(attacker).groupId);
        }
      },
    );

    it.each(PAIRS)(
      "refuses the other business's store id under %s's signed store header (D3135)",
      async (_label, attackerOf, victimOf) => {
        const [attacker, victim] = [attackerOf(world()), victimOf(world())];
        const own = attacker.stores[0].id;
        const foreign = victim.stores[0].id;

        const answers = [
          await signedGet(`/store/provinces/code/${ALGER}?storeId=${foreign}`, own),
          await signedGet(`/store/provinces?storeId=${foreign}`, own),
        ];
        const control = await signedGet(`/store/provinces/code/${ALGER}?storeId=${own}`, own);

        for (const answer of answers) {
          expect(answer.status).toBe(NOT_FOUND);
          expect((JSON.parse(answer.body) as { code?: string }).code).toBe(GEO_ERROR_CODES.STORE_NOT_FOUND);
        }
        expect(control.status).toBe(OK);
        expect((JSON.parse(control.body) as { code?: string }).code).toBe(ALGER);
      },
    );
  });
}
