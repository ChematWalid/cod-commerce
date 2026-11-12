import { PLATFORM_CLOCK, TASK_HEARTBEAT_WRITER } from '@cod/plugin-platform-jobs';
import { getConfigurationFunction, type Injector, type RuntimeVendureConfig } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { KekRotationService } from '../../application/kek-rotation.service';
import { KEK_ROTATION_SCHEDULE, KEK_ROTATION_TASK_ID } from '../../domain/constants';
import { kekRotationTask } from '../../infrastructure/kek-rotation.task';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';

const NOW = Date.UTC(2026, 10, 12, 3, 30);

describe('kekRotationTask', () => {
  it('is the daily 03:30 UTC task named tenant-secret-kek-rotation', () => {
    expect(kekRotationTask.id).toBe('tenant-secret-kek-rotation');
    expect(KEK_ROTATION_TASK_ID).toBe('tenant-secret-kek-rotation');
    expect(kekRotationTask.options.schedule).toBe('30 3 * * *');
    expect(KEK_ROTATION_SCHEDULE).toBe('30 3 * * *');
    expect(kekRotationTask.options.timezone).toBe('UTC');
  });

  it('runs through catchUpTask: queues the stale keys with the platform clock and records the heartbeat', async () => {
    const enqueueStale = vi
      .fn<KekRotationService['enqueueStale']>()
      .mockResolvedValue({ enqueued: 7, remainingOnRetiredKeks: 3 });
    const recordSuccess = vi.fn<(id: string, at: Date) => Promise<void>>().mockResolvedValue(undefined);
    const services = new Map<unknown, unknown>([
      [KekRotationService, { enqueueStale }],
      [PLATFORM_CLOCK, { now: () => NOW }],
      [TASK_HEARTBEAT_WRITER, { recordSuccess }],
    ]);
    const injector = { get: (token: unknown) => services.get(token) } as unknown as Injector;

    const result: unknown = await kekRotationTask.options.execute({
      injector,
      scheduledContext: undefined as never,
      params: {},
    });

    expect(result).toEqual({ enqueued: 7, remaining: 3 });
    expect(enqueueStale).toHaveBeenCalledExactlyOnceWith(new Date(NOW));
    expect(recordSuccess).toHaveBeenCalledExactlyOnceWith(KEK_ROTATION_TASK_ID, new Date(NOW));
  });
});

describe('PlatformSecretsPlugin configuration', () => {
  const configure = (
    tasks: RuntimeVendureConfig['schedulerOptions']['tasks'],
  ): RuntimeVendureConfig['schedulerOptions']['tasks'] => {
    const configuration = getConfigurationFunction(PlatformSecretsPlugin);
    const config = { schedulerOptions: { tasks } } as RuntimeVendureConfig;
    return (configuration?.(config) as RuntimeVendureConfig).schedulerOptions.tasks;
  };

  it('adds the rotation task once, even when configuration runs again', () => {
    const first = configure([]);
    expect(first.filter((task) => task.id === KEK_ROTATION_TASK_ID)).toEqual([kekRotationTask]);
    expect(configure(first).filter((task) => task.id === KEK_ROTATION_TASK_ID)).toHaveLength(1);
  });

  it('keeps the other tasks', () => {
    const other = { id: 'other' } as RuntimeVendureConfig['schedulerOptions']['tasks'][number];
    expect(configure([other]).map((task) => task.id)).toEqual(['other', KEK_ROTATION_TASK_ID]);
  });
});
