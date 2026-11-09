declare const operationContextBrand: unique symbol;

/**
 * The caller's context as the inner layers see it: opaque, so `application/` needs no framework type (A8). It
 * carries the active transaction, so every port call must receive the one it was given.
 */
export interface OperationContext {
  readonly [operationContextBrand]: 'OperationContext';
}
