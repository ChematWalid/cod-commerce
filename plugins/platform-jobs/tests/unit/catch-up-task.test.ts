import { DomainError } from '@cod/shared';
import { type Injector, Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TASK_HEARTBEAT_WRITER } from '../../application/tokens';
import { PLATFORM_CLOCK } from '../../domain/clock.port';
import type { TaskHeartbeatWriter } from '../../domain/task-heartbeat.port';
import { catchUpTask } from '../../infrastructure/catch-up-task';
import { ManualClock } from '../fakes/manual-clock';

class SampleError extends DomainError {
  readonly code = 'sample.failed';
}

const injectorWith = (writer: TaskHeartbeatWriter): Injector =>
  ({
    get: (token: unknown) =>
      token === PLATFORM_CLOCK ? new ManualClock() : token === TASK_HEARTBEAT_WRITER ? writer : undefined,
  }) as unknown as Injector;

const run = (task: ReturnType<typeof catchUpTask>, injector: Injector): Promise<unknown> =>
  task.options.execute({ injector, scheduledContext: undefined as never, params: {} });

const task = (work: () => Promise<Record<string, number>>) =>
  catchUpTask({ id: 'unit-task', schedule: '0 * * * *', description: 'unit', run: work });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('catchUpTask failures', () => {
  it('logs and rethrows when the heartbeat cannot be recorded, without leaking the driver message', async () => {
    // Arrange
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const writer: TaskHeartbeatWriter = { recordSuccess: () => Promise.reject(new Error('password=hunter2 refused')) };

    // Act
    const outcome = run(
      task(() => Promise.resolve({ done: 1 })),
      injectorWith(writer),
    );

    // Assert
    await expect(outcome).rejects.toThrow('refused');
    const [message] = logged.mock.calls[0] ?? [];
    expect(message).toContain('unit-task');
    expect(message).toContain('reason=Error');
    expect(message).not.toContain('hunter2');
  });

  it('logs the code and message of a typed error', async () => {
    // Arrange
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const writer: TaskHeartbeatWriter = { recordSuccess: () => Promise.resolve() };

    // Act
    const outcome = run(
      task(() => Promise.reject(new SampleError('the sample broke'))),
      injectorWith(writer),
    );

    // Assert
    await expect(outcome).rejects.toBeInstanceOf(SampleError);
    expect(logged.mock.calls[0]?.[0]).toContain('sample.failed: the sample broke');
  });
});
