declare const operationContextBrand: unique symbol;

/**
 * The caller's context as the catalog's inner layers see it: opaque, so `application/` needs no framework type. It carries
 * the active transaction, so every port call must receive the one it was given.
 */
export interface OperationContext {
  readonly [operationContextBrand]: 'OperationContext';
}

/** Brands a framework context at the outer edge of the plugin. */
export function asOperationContext(context: object): OperationContext {
  return context as OperationContext;
}
