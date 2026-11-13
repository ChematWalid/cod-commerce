import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256InvitationToken } from '../../infrastructure/sha256-token';

describe('Sha256InvitationToken', () => {
  it('hands out a fresh 256-bit token each time, in URL-safe characters', () => {
    // Arrange
    const tokens = new Sha256InvitationToken();

    // Act
    const [first, second] = [tokens.newToken(), tokens.newToken()];

    // Assert
    expect(first).not.toBe(second);
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes a token to its SHA-256 hex digest', () => {
    // Arrange
    const tokens = new Sha256InvitationToken();
    const token = tokens.newToken();

    // Act
    const hash = tokens.hash(token);

    // Assert
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).toHaveLength(64);
  });
});
