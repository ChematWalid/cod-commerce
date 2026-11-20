import { offerRule } from '../../offers/domain/offer-rule';

/** Forbidden: even an adapter reaches the offers through their entry only, never their internals (D2402). */
export const leakedOfferRule = offerRule;
