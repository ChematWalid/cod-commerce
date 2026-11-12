import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import type { DurableJobData } from '@cod/shared';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLastAttempt, PlatformQueues } from '../../application/platform-queues';
import { PlatformJobsPlugin } from '../../platform-jobs.plugin';
import { createPlatformJobsTestEnvironment } from './platform-jobs-environment';

interface ProbeData extends DurableJobData {
  readonly note: string;
}

interface Seen {
  readonly data: ProbeData;
  readonly attempts: number;
  readonly retries: number;
}

const seen: Seen[] = [];
let failFirst = 0;
const lateDefinitionErrors: unknown[] = [];
const definitionErrors: unknown[] = [];

/** Defines a queue the way a feature plugin does: in `onModuleInit`. */
@Injectable()
class ProbeConsumer implements OnModuleInit {
  constructor(private readonly queues: PlatformQueues) {}

  onModuleInit(): void {
    this.queues.define<ProbeData>('platform-maintenance', (data, job) => {
      seen.push({ data, ...job });
      if (failFirst > 0) {
        failFirst -= 1;
        return Promise.reject(new Error('probe failure'));
      }
      return Promise.resolve();
    });
    this.tryToDefine('platform-maintenance');
    this.tryToDefine('not-a-queue' as never);
  }

  private tryToDefine(name: Parameters<PlatformQueues['define']>[0]): void {
    try {
      this.queues.define(name, () => Promise.resolve());
    } catch (error) {
      definitionErrors.push(error);
    }
  }
}

@VendurePlugin({ imports: [PluginCommonModule, PlatformJobsPlugin], providers: [ProbeConsumer] })
// A Vendure plugin is a decorated class; its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class ProbePlugin {}

const { server } = createPlatformJobsTestEnvironment(undefined, [ProbePlugin]);
const queues = () => server.app.get(PlatformQueues);

const settled = async (predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('the job did not run in time');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterAll(async () => {
  await server.destroy();
});

describe('PlatformQueues', () => {
  it('runs a defined queue job with its data', async () => {
    // Arrange
    const data: ProbeData = { jobId: 'kek-1-k1', note: 'hello' };

    // Act
    await queues().add('platform-maintenance', data);
    await settled(() => seen.some((entry) => entry.data.note === 'hello'));

    // Assert
    const entry = seen.find((candidate) => candidate.data.note === 'hello');
    expect(entry?.data).toEqual(data);
  });

  it('passes the queue registry attempts as retries so the in-memory strategy retries too', async () => {
    // Arrange
    failFirst = 1;

    // Act
    await queues().add('platform-maintenance', { jobId: 'kek-2-k1', note: 'retry' } satisfies ProbeData);
    await settled(() => seen.filter((entry) => entry.data.note === 'retry').length >= 2);

    // Assert
    const runs = seen.filter((entry) => entry.data.note === 'retry');
    expect(runs.map((run) => run.retries)).toEqual([2, 2]);
    expect(runs.map((run) => run.attempts)).toEqual([1, 2]);
    expect(runs.map(isLastAttempt)).toEqual([false, false]);
  });

  it('rejects add on a registered queue nobody defined', async () => {
    // Act
    const add = queues().add('notifications', { jobId: 'x-1' });

    // Assert
    await expect(add).rejects.toMatchObject({ code: 'platform-jobs.queue-not-defined' });
  });

  it('rejects a second definition of a queue and a name outside the registry during onModuleInit', () => {
    // Assert
    // Vendure's test server boots an api app and a worker app, so each failure is recorded once per app.
    const codes = new Set(definitionErrors.map((error) => (error as { code: string }).code));
    expect([...codes]).toEqual(['platform-jobs.queue-already-defined', 'platform-jobs.unregistered-queue']);
  });

  it('rejects a definition after bootstrap', () => {
    // Act
    try {
      queues().define('capi', () => Promise.resolve());
    } catch (error) {
      lateDefinitionErrors.push(error);
    }

    // Assert
    expect(lateDefinitionErrors).toMatchObject([{ code: 'platform-jobs.queue-registry-closed' }]);
  });

  it('requeues a continuation of a continuation with the next suffix and the delay', async () => {
    // Arrange
    const before = seen.length;

    // Act
    await queues().requeueWithDelay('platform-maintenance', { jobId: 'ob-1-r2', note: 'cont' }, 0);
    await settled(() => seen.length > before);

    // Assert
    const entry = seen.find((candidate) => candidate.data.note === 'cont');
    expect(entry?.data).toEqual({ jobId: 'ob-1-r3', note: 'cont', delayMs: 0 });
  });
});
