// The public entry of the catalog (D2104): other plugins import it from infrastructure/ and *.plugin.ts files only,
// apps import it freely. Tasks 10-19 add the services later sessions consume; the handoff lists them.
export { CatalogPlugin } from './catalog.plugin';
