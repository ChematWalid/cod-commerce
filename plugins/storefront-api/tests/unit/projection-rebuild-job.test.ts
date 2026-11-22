import type { PlatformQueues } from '@cod/plugin-platform-jobs';
import { describe, expect, it } from 'vitest';
import type { ProjectionSkip } from '../../application/projection.service';
import type { RevalidationJob, RevalidationQueuePort } from '../../domain/ports/revalidation-queue.port';
import type { StoreScope } from '../../domain/store-scope';
import { type ProjectionRebuilder, ProjectionRebuildJob } from '../../infrastructure/projection-rebuild.job';
import { STORE_A } from '../fakes/fake-storefront';

class RecordingQueue implements RevalidationQueuePort {
  readonly jobs: RevalidationJob[] = [];

  enqueue(job: RevalidationJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}

function setUp(outcome: number | ProjectionSkip = 3) {
  const rebuilt: StoreScope[] = [];
  const rebuilder: ProjectionRebuilder = {
    rebuild: (scope) => {
      rebuilt.push(scope);
      return Promise.resolve(outcome);
    },
  };
  const revalidations = new RecordingQueue();
  const queues = { define: () => undefined } as unknown as PlatformQueues;
  const job = new ProjectionRebuildJob(queues, rebuilder, revalidations);
  return { rebuilt, revalidations, job };
}

const data = { jobId: 'spr-1500000000000000009', ...STORE_A };

describe('ProjectionRebuildJob', () => {
  it('rebuilds the store projection, then expires the store pages built from the old rows', async () => {
    // Arrange
    const { rebuilt, revalidations, job } = setUp();

    // Act
    await job.process(data);

    // Assert
    expect(rebuilt).toEqual([STORE_A]);
    expect(revalidations.jobs).toEqual([
      { key: 'spr-1500000000000000009', storeId: STORE_A.storeId, tags: [`store:${STORE_A.storeId}`] },
    ]);
  });

  it('expires nothing for a store that became unavailable', async () => {
    // Arrange
    const { revalidations, job } = setUp('store-unavailable');

    // Act
    await job.process(data);

    // Assert
    expect(revalidations.jobs).toEqual([]);
  });

  it('drops a job whose payload is malformed', async () => {
    // Arrange
    const { rebuilt, job } = setUp();

    // Act
    await job.process({ jobId: 'spr-1', businessId: 'x', storeId: '1' });

    // Assert
    expect(rebuilt).toEqual([]);
  });
});
