import { catchUpTask } from '@cod/plugin-platform-jobs';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Logger, RequestContextService, type ScheduledTask } from '@vendure/core';
import { ReconcileSweepService } from '../application/reconcile-sweep.service';
import { asOperationContext } from '../domain/ports/operation-context';

/** The nightly sweep's id (ADR 0013 amendment). */
export const COLLECTIONS_RECONCILE_TASK_ID = 'collections-reconcile';
/** 01:30 UTC, 02:30 in Algiers: a quiet hour for the bulk pool. */
const NIGHTLY_SCHEDULE = '30 1 * * *';
const LOG_CONTEXT = 'CollectionsReconcile';

/** Every night, queues the reconcile of every store holding an automatic collection (D2336 (4)). */
export const collectionsReconcileTask: ScheduledTask = catchUpTask({
  id: COLLECTIONS_RECONCILE_TASK_ID,
  schedule: NIGHTLY_SCHEDULE,
  description: 'Queue the membership reconcile of every store with automatic collections',
  run: async (injector) => {
    const ctx = await injector.get(RequestContextService).create({ apiType: 'admin' });
    const stores = await injector.get(ReconcileSweepService).enqueueAll(asOperationContext(ctx));
    return { stores };
  },
});

/**
 * At bootstrap, queues the reconcile of the stores whose automatic collections were built with an older normal form
 * or rule version (D2336 (2)). It runs in the background, so a large platform does not hold the boot; a failure is
 * logged and the nightly sweep covers it.
 */
@Injectable()
export class MatchVersionCheck implements OnApplicationBootstrap {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly sweep: ReconcileSweepService,
  ) {}

  onApplicationBootstrap(): void {
    void this.check().catch((error: unknown) => {
      const reason = error instanceof Error ? error.name : typeof error;
      Logger.error(`The match version check failed: ${reason}`, LOG_CONTEXT);
    });
  }

  /** Answers how many stores were queued. */
  async check(): Promise<number> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    return this.sweep.enqueueStale(asOperationContext(ctx));
  }
}
