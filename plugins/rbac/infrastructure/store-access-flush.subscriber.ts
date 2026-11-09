import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Logger } from '@vendure/core';
import { MEMBER_ASSIGNMENTS, SESSION_FLUSHER } from '../application/tokens';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import { asOperationContext } from '../domain/ports/operation-context';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import { StoreAccessChangedEvent } from './store-access-changed.event';

const LOG_CONTEXT = 'StoreAccessFlushSubscriber';

/** Evicts every all-stores member's session once a new store has committed (D55); `ofType` waits for that commit. */
@Injectable()
export class StoreAccessFlushSubscriber implements OnApplicationBootstrap {
  constructor(
    private readonly eventBus: EventBus,
    @Inject(MEMBER_ASSIGNMENTS) private readonly assignments: MemberAssignmentRepositoryPort,
    @Inject(SESSION_FLUSHER) private readonly flusher: SessionFlusherPort,
  ) {}

  onApplicationBootstrap(): void {
    this.eventBus.ofType(StoreAccessChangedEvent).subscribe((event) => {
      void this.flush(event);
    });
  }

  private async flush({ ctx, businessId }: StoreAccessChangedEvent): Promise<void> {
    try {
      const administratorIds = await this.assignments.allStoresAdministratorIds(asOperationContext(ctx), {
        businessId,
      });
      await this.flusher.flushAdministrators(administratorIds);
    } catch (error: unknown) {
      Logger.error(`Could not flush all-stores members of a business: ${String(error)}`, LOG_CONTEXT);
    }
  }
}
