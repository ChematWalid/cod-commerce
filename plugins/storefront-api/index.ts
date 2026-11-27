// The public entry of the storefront API: only the server registers the plugin; the storefront app calls its REST
// routes (ADR 0017) and never imports it.
export type { StorefrontApiPluginOptions, StorefrontTarget } from './infrastructure/plugin-options';
// The demo seed builds the projection of the stores it made, so a fresh stack lists products before the worker runs.
export { type BackfillCounts, ProjectionBackfill } from './infrastructure/projection-backfill';
export { StorefrontApiPlugin } from './storefront-api.plugin';
