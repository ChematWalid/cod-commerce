import { TenantContextMissingError } from '@cod/plugin-tenancy';
import { type TenantScope, toBusinessId } from '@cod/shared';
import { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import type { ActivityLogService } from '../../application/activity-log.service';
import type { ActivityEntryInput } from '../../domain/activity';
import { ActivityRecordEvent } from '../../infrastructure/activity-record.event';
import { ActivityRecordHandler } from '../../infrastructure/activity-record.handler';

type BlockingHandler = (event: ActivityRecordEvent) => Promise<void>;

/** Keeps the one blocking handler the class registers, so the test can call it. */
class CapturingEventBus {
  handler: BlockingHandler | undefined;

  registerBlockingEventHandler(options: { readonly handler: BlockingHandler }): void {
    this.handler = options.handler;
  }
}

const ENTRY = {
  actorAdministratorId: 7,
  action: 'team.invitation.accepted',
  entityType: 'member',
  entityId: '1100000000000000001',
  summary: 'Invitation accepted',
  diff: {},
  ip: null,
  userAgent: null,
};

function arrangeHandler(): { bus: CapturingEventBus; recorded: ActivityEntryInput[] } {
  const bus = new CapturingEventBus();
  const recorded: ActivityEntryInput[] = [];
  const activity = {
    record: (_ctx: unknown, entry: ActivityEntryInput) => {
      recorded.push(entry);
      return Promise.resolve();
    },
  } as unknown as ActivityLogService;
  new ActivityRecordHandler(bus as never, activity).onModuleInit();
  return { bus, recorded };
}

describe('ActivityRecordHandler', () => {
  it('records an event of a context no tenant guard ran for under the scope the event names', async () => {
    // Arrange
    const { bus, recorded } = arrangeHandler();
    const scope: TenantScope = { businessId: toBusinessId('101') };

    // Act
    await bus.handler?.(new ActivityRecordEvent(RequestContext.empty(), ENTRY, scope));

    // Assert
    expect(recorded).toEqual([{ ...ENTRY, scope }]);
  });

  it('refuses an event without a scope from a context no tenant guard ran for', async () => {
    // Arrange
    const { bus } = arrangeHandler();

    // Act
    const recording = bus.handler?.(new ActivityRecordEvent(RequestContext.empty(), ENTRY));

    // Assert
    await expect(recording).rejects.toBeInstanceOf(TenantContextMissingError);
  });
});
