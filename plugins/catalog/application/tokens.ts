/** Injection tokens of the catalog's ports; the adapters behind them are wired in `infrastructure/*.providers.ts`. */
export const PRODUCT_CATALOG = Symbol('CatalogProductCatalog');
export const PRODUCT_SEARCH = Symbol('CatalogProductSearch');
export const PRODUCT_EVENTS = Symbol('CatalogProductEvents');
export const TRANSACTION = Symbol('CatalogTransaction');
export const BRAND_REPOSITORY = Symbol('CatalogBrandRepository');
export const TAG_REPOSITORY = Symbol('CatalogTagRepository');
export const HIGHLIGHT_REPOSITORY = Symbol('CatalogHighlightRepository');
export const PRODUCT_SETTINGS_REPOSITORY = Symbol('CatalogProductSettingsRepository');
export const MEDIA_REPOSITORY = Symbol('CatalogMediaRepository');
export const PRODUCT_COLLECTION_REPOSITORY = Symbol('CatalogProductCollectionRepository');
export const DESCRIPTION_SANITIZER = Symbol('CatalogDescriptionSanitizer');
export const ID_GENERATOR = Symbol('CatalogIdGenerator');
export const CLOCK = Symbol('CatalogClock');
export const PRODUCT_PORTS = Symbol('CatalogProductPorts');
export const ORDER_MANAGER_CHECK_REGISTRAR = Symbol('CatalogOrderManagerCheckRegistrar');
