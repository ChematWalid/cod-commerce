import { describe, expect, it, vi } from 'vitest';
import { createPingOutcomeLog } from '../../src/health/redis-ping';

const refused = new Error('connect ECONNREFUSED 127.0.0.1:6379');

describe('readiness ping outcome log', () => {
  it('logs a repeated failure once while Valkey stays down', () => {
    // Arrange
    const writeFailure = vi.fn();
    const log = createPingOutcomeLog(writeFailure, vi.fn());
    // Act
    log.failed(refused);
    log.failed(refused);
    log.failed(refused);
    // Assert
    expect(writeFailure).toHaveBeenCalledTimes(1);
  });

  it('logs again when the failure message changes', () => {
    const writeFailure = vi.fn();
    const log = createPingOutcomeLog(writeFailure, vi.fn());
    log.failed(refused);
    log.failed(new Error('PING timed out after 500 ms'));
    expect(writeFailure).toHaveBeenCalledTimes(2);
  });

  it('logs the recovery once, then the next outage afresh', () => {
    // Arrange
    const writeFailure = vi.fn();
    const writeRecovery = vi.fn();
    const log = createPingOutcomeLog(writeFailure, writeRecovery);
    // Act
    log.failed(refused);
    log.succeeded();
    log.succeeded();
    log.failed(refused);
    // Assert
    expect(writeRecovery).toHaveBeenCalledTimes(1);
    expect(writeFailure).toHaveBeenCalledTimes(2);
  });

  it('logs nothing while every ping succeeds', () => {
    const writeFailure = vi.fn();
    const writeRecovery = vi.fn();
    const log = createPingOutcomeLog(writeFailure, writeRecovery);
    log.succeeded();
    expect(writeFailure).not.toHaveBeenCalled();
    expect(writeRecovery).not.toHaveBeenCalled();
  });
});
