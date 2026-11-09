import type { OperationContext } from './operation-context';

/** Puts a sealed email request on the worker queue once the caller's transaction has committed. */
export interface AuthEmailQueuePort {
  /** A rolled-back transaction queues nothing. */
  enqueue(ctx: OperationContext, sealed: string): Promise<void>;
}
