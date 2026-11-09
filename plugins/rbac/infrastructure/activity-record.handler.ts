import { asOperationContext } from '../domain/ports/operation-context';
import { tenantOf } from '@cod/plugin-tenancy';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { ActivityLogService } from '../application/activity-log.service';
import { ActivityRecordEvent } from './activity-record.event';

const HANDLER_ID = 'rbac-activity-record';

/**
 * Records every {@link ActivityRecordEvent}. A blocking handler runs inside `publish` and shares the event
 * context's transaction; an `ofType` subscriber would run after commit (D66).
 */
@Injectable()
export class ActivityRecordHandler implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    @Inject(ActivityLogService) private readonly activity: ActivityLogService,
  ) {}

  onModuleInit(): void {
    this.eventBus.registerBlockingEventHandler({
      event: ActivityRecordEvent,
      id: HANDLER_ID,
      handler: async ({ ctx, entry }) => {
        await this.activity.record(asOperationContext(ctx), { ...entry, scope: tenantOf(ctx) });
      },
    });
  }
}
