import { describe, expect, it } from 'vitest';
import { AuthEmailDelivery } from '../../application/auth-email-delivery';
import { RECIPIENT_HASH_DOMAIN, RECIPIENT_HASH_LENGTH } from '../../domain/constants';
import { AuthEmailDeliveryError } from '../../domain/email';
import type { SecretHasherPort } from '../../domain/ports/secret-hasher.port';
import { SealedPayloadCodec } from '../../infrastructure/sealed-payload';
import { EchoTemplates, RecordingSender } from '../fakes/recording-email';

const SECRET = 'unit-test-only-secret-0000000000000000';
const HASH = 'ab'.repeat(32);

/** Keeps every string it is asked to hash, so a test sees exactly what the recipient hash was made from. */
class RecordingHasher implements SecretHasherPort {
  readonly hashed: string[] = [];

  newToken(): string {
    return 'token';
  }

  newOtp(): string {
    return '123456';
  }

  hash(secret: string): string {
    this.hashed.push(secret);
    return HASH;
  }

  matches(): boolean {
    return false;
  }
}

describe('AuthEmailDelivery recipient hash', () => {
  it('hashes the trimmed, lower-cased address under the recipient: prefix, so it differs from a token hash', async () => {
    // Arrange
    const sealer = new SealedPayloadCodec(SECRET);
    const sender = new RecordingSender();
    sender.failures = 1;
    const hasher = new RecordingHasher();
    const delivery = new AuthEmailDelivery(sealer, new EchoTemplates(), sender, hasher);
    const sealed = sealer.seal({
      kind: 'password-changed',
      to: ' Owner@Example.test ',
      locale: 'en',
      vars: { name: 'S' },
    });

    // Act
    const error = (await delivery.deliver(sealed).catch((caught: unknown) => caught)) as AuthEmailDeliveryError;

    // Assert
    expect(RECIPIENT_HASH_DOMAIN).toBe('recipient:');
    expect(hasher.hashed).toEqual(['recipient:owner@example.test']);
    expect(error.recipientHash).toBe(HASH.slice(0, RECIPIENT_HASH_LENGTH));
  });
});
