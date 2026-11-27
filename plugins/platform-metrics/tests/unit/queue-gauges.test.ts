import { describe, expect, it } from 'vitest';
import { queueGaugesOf, type QueuedJob } from '../../domain/queue-gauges';

const NOW = 1_000_000_000_000;
const job = (name: string, state: QueuedJob['state'], secondsAgo: number): QueuedJob => ({
  name,
  state,
  enqueuedAtMs: NOW - secondsAgo * 1000,
});

describe('queueGaugesOf', () => {
  it('counts the jobs of a pool by job name and state', () => {
    // Arrange
    const jobs = [
      job('dispatch', 'waiting', 5),
      job('dispatch', 'waiting', 9),
      job('dispatch', 'failed', 60),
      job('notifications', 'active', 1),
    ];

    // Act
    const { counts } = queueGaugesOf(jobs, NOW);

    // Assert
    expect(counts).toEqual(
      expect.arrayContaining([
        { queue: 'dispatch', state: 'waiting', count: 2 },
        { queue: 'dispatch', state: 'failed', count: 1 },
        { queue: 'notifications', state: 'active', count: 1 },
      ]),
    );
    expect(counts).toHaveLength(3);
  });

  it('reports the age of the oldest waiting job of each queue, ignoring other states', () => {
    // Arrange
    const jobs = [
      job('dispatch', 'waiting', 5),
      job('dispatch', 'waiting', 42),
      job('dispatch', 'delayed', 900),
      job('ai', 'active', 300),
    ];

    // Act
    const { oldestWaiting } = queueGaugesOf(jobs, NOW);

    // Assert
    expect(oldestWaiting).toEqual([{ queue: 'dispatch', ageSeconds: 42 }]);
  });

  it('reads a job enqueued after now as 0 seconds old', () => {
    // Arrange
    const jobs = [job('dispatch', 'waiting', -3)];

    // Act
    const { oldestWaiting } = queueGaugesOf(jobs, NOW);

    // Assert
    expect(oldestWaiting).toEqual([{ queue: 'dispatch', ageSeconds: 0 }]);
  });
});
