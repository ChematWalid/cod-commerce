/** Injection tokens of the plugin's ports; the adapters behind them are wired in `infrastructure/collections.providers.ts`. */
export const DEFINITION_REPOSITORY = Symbol('CollectionsDefinitionRepository');
export const MEMBER_REPOSITORY = Symbol('CollectionsMemberRepository');
export const STORE_LOCK = Symbol('CollectionsStoreLock');
export const PRODUCT_FACTS = Symbol('CollectionsProductFacts');
export const ID_GENERATOR = Symbol('CollectionsIdGenerator');
