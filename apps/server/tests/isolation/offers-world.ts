import type { INestApplicationContext } from '@nestjs/common';
import { asOperationContext, OfferAdminService, type OperationContext, type StoreScope } from '@cod/plugin-offers';
import { type OfferInput, toBusinessId, toStoreId } from '@cod/shared';
import { RequestContextService } from '@vendure/core';
import { catalogOf, restIdOf } from './catalog-world';
import { fieldOf, type IsolationHttp } from './http';
import { ownChannel } from './matrix';
import { type OffersWorld, SHARED_CODE } from './offers-rows';
import { CREATE_ROLE, OFFERS_AREA_LEVELS, SET_MEMBER_ACCESS } from './seed-operations';
import type { BusinessWorld, WorldStore } from './world-types';

export { OFFERS_WORLDS, offersFingerprints, offersOf, type OffersWorld, SHARED_CODE } from './offers-rows';

/**
 * What each seeded offer takes off every unit (D2409 percent). The automatic and code offers differ so their amounts
 * cannot be confused; both businesses seed the same percents, so a cross-business leak is detected by offer id.
 */
const AUTOMATIC_PERCENT = 10;
const CODE_PERCENT = 20;
/** Above the automatic offer's percent, so a quote with the shared code applies the shared code's offer. */
const SHARED_CODE_PERCENT = 30;

/** A context on `store`'s own channel, as the scoped pricing and admin cores are called (D2408). */
export async function storeContextOf(app: INestApplicationContext, store: WorldStore): Promise<OperationContext> {
  const ctx = await app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: store.channelToken });
  return asOperationContext(ctx);
}

/** The scope of `business`'s `store`. */
export const scopeOf = (business: BusinessWorld, store: WorldStore): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

const offerInputOf = (variantId: string, method: 'automatic' | 'codes', percent: number): OfferInput => ({
  kind: 'product_discount',
  method,
  title: `Isolation ${method} offer ${String(percent)}%`,
  config: { valueType: 'percent', value: percent, appliesTo: 'all' },
  targets: [{ refType: 'variant', refId: variantId }],
});

/**
 * Gives the world's member an offers role beside its own and catalog roles, still on the first store only (D2132): the
 * member-other-store cells are then refused by the store restriction, not by a missing offers permission.
 */
async function grantOffersToMember(http: IsolationHttp, business: BusinessWorld): Promise<OffersWorld['offersRole']> {
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(business.owner, query, variables, ownChannel(business)), field) as T;
  const roleInput = { name: `Offers role ${business.label} ${business.businessId}`, areaLevels: OFFERS_AREA_LEVELS };
  const role = await as<{ id: string; name: string }>(CREATE_ROLE, { input: roleInput }, 'createBusinessRole');
  const access = {
    administratorId: business.member.administratorId,
    roleIds: [business.role.id, catalogOf(business).catalogRole.id, role.id],
    storeAccess: 'selected',
    storeIds: [business.stores[0].id],
  };
  await as(SET_MEMBER_ACCESS, { input: access }, 'setMemberAccess');
  return { id: role.id, name: role.name };
}

/**
 * Seeds `business`'s offers in process, before the matrix reaches them over HTTP: every offer is published, each code
 * offer gets its code; then the member gets its offers role over HTTP. Runs after `seedCatalog` (the targets name the
 * catalog product's variant, and the member keeps its catalog role).
 *
 * @throws Error when the business has no catalog rows, the catalog product has no variant, or a code is not stored.
 */
export async function seedOffers(
  app: INestApplicationContext,
  http: IsolationHttp,
  business: BusinessWorld,
): Promise<OffersWorld> {
  const [variant] = catalogOf(business).product.variantIds;
  if (variant === undefined) throw new Error(`business ${business.label}: the catalog product has no variant`);
  const variantId = restIdOf(variant);
  const store = business.stores[0];
  const admin = app.get(OfferAdminService);
  const ctx = await storeContextOf(app, store);
  const scope = scopeOf(business, store);
  const publish = async (input: OfferInput): Promise<string> => {
    const draft = await admin.createDraft(ctx, scope, input);
    return (await admin.publish(ctx, scope, draft.id)).id;
  };
  const addCode = async (offerId: string, code: string): Promise<string> => {
    const [stored] = await admin.addCodes(ctx, scope, offerId, [{ code }]);
    if (stored === undefined) throw new Error(`business ${business.label}: the offer code ${code} was not stored`);
    return stored.code;
  };
  const automaticOfferId = await publish(offerInputOf(variantId, 'automatic', AUTOMATIC_PERCENT));
  const codeOfferId = await publish(offerInputOf(variantId, 'codes', CODE_PERCENT));
  const sharedCodeOfferId = await publish(offerInputOf(variantId, 'codes', SHARED_CODE_PERCENT));
  const code = await addCode(codeOfferId, `iso-${business.label}-${business.businessId}`);
  const sharedCode = await addCode(sharedCodeOfferId, SHARED_CODE);
  const offersRole = await grantOffersToMember(http, business);
  return { automaticOfferId, codeOfferId, code, sharedCodeOfferId, sharedCode, variantId, offersRole };
}
