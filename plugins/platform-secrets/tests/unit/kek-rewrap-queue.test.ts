import type { JobPresencePort, PlatformQueues } from '@cod/plugin-platform-jobs';
import { describe, expect, it, vi } from 'vitest';
import type { KekRewrapJobData } from '../../domain/kek-rewrap-job';
import { KEK_REWRAP_QUEUE_NAME, PlatformKekRewrapQueue } from '../../infrastructure/kek-rewrap.job';

const JOB = { jobId: 'rewrap-1', businessId: '1' } as unknown as KekRewrapJobData;

describe('PlatformKekRewrapQueue', () => {
  it('logs a warning with the job id and the reason when the presence cannot be read, and still adds the job', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const presence: JobPresencePort = {
      stateOf: vi.fn().mockRejectedValue(new Error('valkey unreachable')),
      remove: vi.fn(),
    };
    const warn = vi.fn();
    const queue = new PlatformKekRewrapQueue({ add } as unknown as PlatformQueues, presence, {
      warn,
      log: vi.fn(),
      error: vi.fn(),
    } as never);

    await queue.enqueue(JOB);

    expect(add).toHaveBeenCalledWith(KEK_REWRAP_QUEUE_NAME, JOB);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('rewrap-1');
    expect(message).toContain('valkey unreachable');
  });
});
