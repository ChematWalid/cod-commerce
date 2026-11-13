import { PLATFORM_CLOCK, type PlatformClock, TaskHeartbeatReader } from '@cod/plugin-platform-jobs';
import { platformStaffPermission } from '@cod/plugin-tenancy';
import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { Allow, ConfigService } from '@vendure/core';
import type { OutboxDueScanPort } from '../application/ports';
import { OUTBOX_DUE_SCAN } from '../application/tokens';

const MS_PER_SECOND = 1000;

/** One scheduled task and how long ago it last finished a run without error. */
export interface TaskHealth {
  readonly id: string;
  readonly lastSuccessAgeSeconds: number | null;
}

/** What platform staff watch until the metrics exporter exists (D120). */
export interface PlatformJobsHealth {
  readonly outboxPending: number;
  readonly outboxOldestPendingAgeSeconds: number | null;
  readonly tasks: readonly TaskHealth[];
}

const ageSeconds = (now: number, then: Date): number => Math.max(0, Math.floor((now - then.getTime()) / MS_PER_SECOND));

/** The platform's jobs health, for staff only. */
@Resolver()
export class JobsHealthResolver {
  constructor(
    @Inject(OUTBOX_DUE_SCAN) private readonly scan: OutboxDueScanPort,
    @Inject(TaskHeartbeatReader) private readonly heartbeats: TaskHeartbeatReader,
    @Inject(PLATFORM_CLOCK) private readonly clock: PlatformClock,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** Pending outbox events, the age of the oldest, and every scheduled task's last success. */
  @Query()
  @Allow(platformStaffPermission.Permission)
  async platformJobsHealth(): Promise<PlatformJobsHealth> {
    const now = this.clock.now();
    const summary = await this.scan.pendingSummary();
    const lastSuccess = await this.heartbeats.lastSuccess();
    const ids = new Set([...this.config.schedulerOptions.tasks.map((task) => task.id), ...lastSuccess.keys()]);
    const tasks = [...ids].sort().map((id) => {
      const at = lastSuccess.get(id);
      return { id, lastSuccessAgeSeconds: at === undefined ? null : ageSeconds(now, at) };
    });
    return {
      outboxPending: summary.pending,
      outboxOldestPendingAgeSeconds: summary.oldest === null ? null : ageSeconds(now, summary.oldest),
      tasks,
    };
  }
}
