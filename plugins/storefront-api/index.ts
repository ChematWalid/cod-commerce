// The public entry of the storefront API: only the server registers the plugin; the storefront app calls its REST
// routes (ADR 0017) and never imports it.
export { StorefrontApiPlugin } from './storefront-api.plugin';
