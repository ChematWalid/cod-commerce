import type { RequestContext } from '@vendure/core';
import type { OperationContext } from '../application/ports/operation-context';

/** The Vendure context behind an {@link OperationContext}, which only this layer knows about. */
export const toRequestContext = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;
