// The public entry of the offers (D2402, rule `offers-entry-infra-only`): another plugin imports it only from its
// infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does (frontends are API
// clients, ADR 0017). api/, application/, domain/ and dashboard/ never do, and the catalog never does
// (`catalog-no-offers`). Later tasks add PricingService, OfferAdminService, the registrar tokens and port types.
export { OffersPlugin, type OffersPluginOptions } from './offers.plugin';
