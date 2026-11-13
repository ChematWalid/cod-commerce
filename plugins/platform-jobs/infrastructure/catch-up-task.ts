import { DomainError } from '@cod/shared';
import { type Injector, Logger, ScheduledTask } from '@vendure/core';
import { TASK_HEARTBEAT_WRITER } from '../application/tokens';
import { PLATFORM_CLOCK, type PlatformClock } from '../domain/clock.port';
import { TASK_ID_MAX_LENGTH } from '../domain/constants';
import { InvalidTaskIdError } from '../domain/errors';
import type { TaskHeartbeatWriter } from '../domain/task-heartbeat.port';

const LOG_CONTEXT = 'CatchUpTask';

/**
 * What may be logged about a failure: the code and message of our own typed errors, which never carry secrets
 * (Global Constraints), and only the class name of anything else, whose message could hold a value or a query.
 */
function describeFailure(error: unknown): string {
  if (error instanceof DomainError) return `${error.code}: ${error.message}`;
  return `reason=${error instanceof Error ? error.name : typeof error}`;
}

/** What {@link catchUpTask} needs to describe one scheduled task. */
export interface CatchUpTaskConfig {
  readonly id: string;
  /** A cron expression, evaluated in UTC. */
  readonly schedule: string;
  readonly description: string;
  readonly timeoutMs?: number;
  /** Does the work due at `now` and returns counts for the scheduler's log. It must be safe to run late and twice. */
  readonly run: (injector: Injector, now: Date) => Promise<Record<string, number>>;
}

/**
 * A scheduled task that catches up: the scheduler only says "now", and `run` finds what is due from the data
 * (a missed run is made up by the next). `now` comes from the platform clock. After a run that does not throw, the
 * task's heartbeat moves to that `now`; a throw is logged and rethrown and leaves the heartbeat alone (D120).
 * @throws InvalidTaskIdError for an id the heartbeat table cannot store.
 */
export function catchUpTask(config: CatchUpTaskConfig): ScheduledTask {
  if (config.id === '' || config.id.length > TASK_ID_MAX_LENGTH) throw new InvalidTaskIdError(config.id);
  return new ScheduledTask({
    id: config.id,
    description: config.description,
    schedule: config.schedule,
    timezone: 'UTC',
    ...(config.timeoutMs === undefined ? {} : { timeout: config.timeoutMs }),
    async execute({ injector }) {
      const now = new Date(injector.get<PlatformClock>(PLATFORM_CLOCK).now());
      try {
        const counts = await config.run(injector, now);
        await injector.get<TaskHeartbeatWriter>(TASK_HEARTBEAT_WRITER).recordSuccess(config.id, now);
        return counts;
      } catch (error) {
        Logger.error(`Scheduled task ${config.id} failed: ${describeFailure(error)}`, LOG_CONTEXT);
        throw error;
      }
    },
  });
}
