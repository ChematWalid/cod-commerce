import { describe, expect, it } from 'vitest';
import { CACHE_COMMANDS_QUEUE_MAX_LENGTH, CONNECT_TIMEOUT_MS } from '../../cache/constants';
import { redisClientOptions } from '../../cache/lazy-redis-client';

describe('Valkey client options', () => {
  it('bounds the socket connect time and the command queue, and never queues while offline', () => {
    // Act
    const options = redisClientOptions('redis://valkey:6379');
    // Assert
    expect(options).toEqual({
      url: 'redis://valkey:6379',
      disableOfflineQueue: true,
      commandsQueueMaxLength: CACHE_COMMANDS_QUEUE_MAX_LENGTH,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS },
    });
  });
});
