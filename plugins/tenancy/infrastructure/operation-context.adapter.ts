import type { RequestContext } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';

/** The Vendure context behind an {@link OperationContext}, which only this layer knows about. */
export function toRequestContext(context: OperationContext): RequestContext {
  return context as unknown as RequestContext;
}
