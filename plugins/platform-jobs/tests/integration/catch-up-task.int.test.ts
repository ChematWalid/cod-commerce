import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { catchUpTask } from '../../infrastructure/catch-up-task';
import { TaskHeartbeatReader } from '../../domain/task-heartbeat.port';
import { ManualClock } from '../fakes/manual-clock';
import { createPlatformJobsTestEnvironment } from './platform-jobs-environment';

const clock = new ManualClock();
const { server } = createPlatformJobsTestEnvironment(clock);
const injector = () => new Injector(server.app.get(ModuleRef));
const lastSuccess = () => server.app.get(TaskHeartbeatReader).lastSuccess();

const T0 = new Date('2026-11-10T08:00:00.000Z');
const T1 = new Date('2026-11-10T08:05:00.000Z');

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterAll(async () => {
  await server.destroy();
});

describe('catchUpTask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const execute = (task: ReturnType<typeof catchUpTask>) =>
    task.options.execute({ injector: injector(), scheduledContext: undefined as never, params: {} });

  it('records the heartbeat with the run time after a success and returns the counts', async () => {
    // Arrange
    clock.set(T0.getTime());
    const task = catchUpTask({
      id: 'probe-ok',
      schedule: '*/5 * * * *',
      description: 'succeeds',
      run: (_injector, now) => Promise.resolve({ at: now.getTime() }),
    });

    // Act
    const result: unknown = await execute(task);

    // Assert
    expect(result).toEqual({ at: T0.getTime() });
    expect((await lastSuccess()).get('probe-ok')).toEqual(T0);
  });

  it('moves the heartbeat forward on the next success', async () => {
    // Arrange
    clock.set(T1.getTime());
    const task = catchUpTask({
      id: 'probe-ok',
      schedule: '*/5 * * * *',
      description: 'succeeds',
      run: () => Promise.resolve({}),
    });

    // Act
    await execute(task);

    // Assert
    expect((await lastSuccess()).get('probe-ok')).toEqual(T1);
  });

  it('leaves the heartbeat unchanged, logs the error and rethrows when the run throws', async () => {
    // Arrange
    clock.set(T0.getTime());
    await execute(
      catchUpTask({ id: 'probe-bad', schedule: '0 * * * *', description: 'x', run: () => Promise.resolve({}) }),
    );
    clock.set(T1.getTime());
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const failing = catchUpTask({
      id: 'probe-bad',
      schedule: '0 * * * *',
      description: 'fails',
      run: () => Promise.reject(new Error('boom')),
    });

    // Act
    const outcome = execute(failing);

    // Assert
    await expect(outcome).rejects.toThrow('boom');
    expect((await lastSuccess()).get('probe-bad')).toEqual(T0);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('probe-bad'), expect.any(String));
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('boom');
  });

  it('exposes the id, schedule and timeout to the scheduler', () => {
    // Act
    const task = catchUpTask({
      id: 'probe-cfg',
      schedule: '0 2 * * *',
      description: 'cfg',
      timeoutMs: 300_000,
      run: () => Promise.resolve({}),
    });

    // Assert
    expect(task.id).toBe('probe-cfg');
    expect(task.options).toMatchObject({ schedule: '0 2 * * *', timeout: 300_000 });
  });
});
