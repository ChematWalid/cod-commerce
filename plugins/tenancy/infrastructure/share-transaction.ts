import type { RequestContext } from '@vendure/core';

type ContextWithSymbols = RequestContext & Record<symbol, unknown>;

/** Vendure keeps the transaction under a symbol it does not export, and that symbol is a context's only one. */
export function shareTransaction(from: RequestContext, to: RequestContext): RequestContext {
  for (const key of Object.getOwnPropertySymbols(from)) {
    (to as ContextWithSymbols)[key] = (from as ContextWithSymbols)[key];
  }
  return to;
}
