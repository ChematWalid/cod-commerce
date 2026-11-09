import { describe, expect, it, vi } from 'vitest';
import { PasswordResetService, type PasswordResetPorts } from '../../application/password-reset.service';
import type { OperationContext } from '../../domain/ports/operation-context';

const ctx = {} as OperationContext;

function serviceWith(): { service: PasswordResetService; findByEmail: ReturnType<typeof vi.fn>; queued: string[] } {
  const findByEmail = vi.fn();
  const queued: string[] = [];
  const ports = {
    identity: { findByEmail },
    throttle: { spendForEmail: () => Promise.resolve() },
    queue: {
      enqueueResetRequest: (_ctx: OperationContext, sealed: string) => {
        queued.push(sealed);
        return Promise.resolve();
      },
    },
    sealer: { seal: (value: unknown) => JSON.stringify(value), open: (value: string) => JSON.parse(value) as unknown },
  } as unknown as PasswordResetPorts;
  return { service: new PasswordResetService(ports), findByEmail, queued };
}

describe('PasswordResetService.request', () => {
  it('only queues, looking no account up, so known and unknown emails take one path (D27)', async () => {
    // Arrange
    const { service, findByEmail, queued } = serviceWith();

    // Act
    await service.request(ctx, 'known@example.test');
    await service.request(ctx, 'unknown@example.test');

    // Assert
    expect(findByEmail).not.toHaveBeenCalled();
    expect(queued).toHaveLength(2);
  });

  it('queues the normalised address', async () => {
    // Arrange
    const { service, queued } = serviceWith();

    // Act
    await service.request(ctx, '  MiXed@Example.Test ');

    // Assert
    expect(JSON.parse(queued[0] ?? '{}')).toEqual({ email: 'mixed@example.test' });
  });
});
