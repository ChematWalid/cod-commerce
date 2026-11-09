import type { OperationContext } from '../domain/ports/operation-context';
import type { RequestContext } from '@vendure/core';

/** The Vendure context behind an {@link OperationContext}, which only this layer knows about. */
export const toRequestContext = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;
