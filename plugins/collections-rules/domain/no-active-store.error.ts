/**
 * A public read was asked from a context that names no active store of a tenant, or whose channel is not that store's
 * (D2142, D2316): a fault of the calling plugin, never the buyer's input, so it is no `DomainError` and has no API code.
 */
export class CollectionsNoActiveStoreError extends Error {
  constructor() {
    super('A collections read needs the active store of a resolved tenant, on that store channel');
    this.name = 'CollectionsNoActiveStoreError';
  }
}
