/** Injection token of the `ProjectionRebuildQueuePort` the projection consumer queues store rebuilds on. */
export const PROJECTION_REBUILD_QUEUE_PORT: unique symbol = Symbol('ProjectionRebuildQueuePort');

/** Injection token of the `RevalidationQueuePort` revalidations are queued on. */
export const REVALIDATION_QUEUE_PORT: unique symbol = Symbol('RevalidationQueuePort');

/** Injection token of the `ProjectionRebuilder` the rebuild job runs a store rebuild with. */
export const PROJECTION_REBUILDER: unique symbol = Symbol('ProjectionRebuilder');
