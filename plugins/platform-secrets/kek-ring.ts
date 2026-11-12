/**
 * The key ring's parser as its own entry point (`@cod/plugin-platform-secrets/kek-ring`): the server's environment
 * schema validates `TENANT_SECRET_KEKS` with it, and the plugin entry would drag Vendure into that schema's tests.
 * It imports no framework.
 */
export { InvalidKekRingError, type KekEntry, parseKekEntries, parseKekRing } from './infrastructure/kek-ring';
export type { KekRing } from './domain/ports/envelope-cipher.port';
