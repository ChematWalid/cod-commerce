import { beforeEach, describe, expect, it } from 'vitest';
import { AuthEmailDelivery } from '../../application/auth-email-delivery';
import { AuthEmailService } from '../../application/auth-email.service';
import { AuthEmailDeliveryError, InvalidAuthEmailRequestError } from '../../domain/email';
import type { OperationContext } from '../../domain/ports/operation-context';
import { HmacSecretHasher } from '../../infrastructure/hmac-secret-hasher';
import { SealedPayloadCodec } from '../../infrastructure/sealed-payload';
import { EchoTemplates, RecordingQueue, RecordingSender } from '../fakes/recording-email';

const SECRET = 'unit-test-only-secret-0000000000000000';
const CTX = {} as OperationContext;
const RAW_TOKEN = 'raw-token-value-that-must-not-be-readable';
const REQUEST = {
  kind: 'verification',
  to: 'Owner@Example.test',
  locale: 'ar',
  vars: { name: 'Sara', link: `https://dash.test/verify?token=${RAW_TOKEN}`, code: '482913' },
} as const;

describe('AuthEmailService and AuthEmailDelivery', () => {
  let queue: RecordingQueue;
  let sender: RecordingSender;
  let service: AuthEmailService;
  let delivery: AuthEmailDelivery;

  beforeEach(() => {
    const sealer = new SealedPayloadCodec(SECRET);
    queue = new RecordingQueue();
    sender = new RecordingSender();
    service = new AuthEmailService(queue, sealer);
    delivery = new AuthEmailDelivery(sealer, new EchoTemplates(), sender, new HmacSecretHasher(SECRET));
  });

  it('queues a sealed payload that holds no raw token, code or address', async () => {
    // Act
    await service.enqueue(CTX, REQUEST);

    // Assert
    expect(queue.queued).toHaveLength(1);
    expect(queue.queued[0]).not.toContain(RAW_TOKEN);
    expect(queue.queued[0]).not.toContain('482913');
    expect(queue.queued[0]?.toLowerCase()).not.toContain('example.test');
  });

  it('delivers the rendered message to the recipient', async () => {
    // Arrange
    await service.enqueue(CTX, REQUEST);

    // Act
    await delivery.deliver(queue.queued[0] ?? '');

    // Assert
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ to: 'Owner@Example.test', subject: 'verification/ar' });
    expect(sender.sent[0]?.text).toContain(RAW_TOKEN);
    expect(sender.sent[0]?.text).toContain('code=482913');
  });

  it('refuses a request with a variable missing, before queueing', async () => {
    await expect(service.enqueue(CTX, { ...REQUEST, vars: { name: 'Sara' } })).rejects.toThrow(
      InvalidAuthEmailRequestError,
    );
    expect(queue.queued).toHaveLength(0);
  });

  it('refuses an unknown kind or locale', async () => {
    await expect(service.enqueue(CTX, { ...REQUEST, kind: 'newsletter' as never })).rejects.toThrow(
      InvalidAuthEmailRequestError,
    );
    await expect(service.enqueue(CTX, { ...REQUEST, locale: 'fr' as never })).rejects.toThrow(
      InvalidAuthEmailRequestError,
    );
  });

  it('fails delivery with the kind and a recipient hash, never the address or the body', async () => {
    // Arrange
    await service.enqueue(CTX, REQUEST);
    sender.failures = 1;

    // Act
    const error = await delivery.deliver(queue.queued[0] ?? '').catch((caught: unknown) => caught);

    // Assert
    expect(error).toBeInstanceOf(AuthEmailDeliveryError);
    const failure = error as AuthEmailDeliveryError;
    expect(failure.kind).toBe('verification');
    expect(failure.reason).toBe('EENVELOPE');
    expect(failure.recipientHash).toMatch(/^[0-9a-f]{16}$/);
    const visible = `${failure.message} ${failure.recipientHash ?? ''} ${failure.reason}`.toLowerCase();
    expect(visible).not.toContain('example.test');
    expect(visible).not.toContain(RAW_TOKEN);
  });

  it('hashes the same recipient the same way whatever its case', async () => {
    // Arrange
    await service.enqueue(CTX, REQUEST);
    await service.enqueue(CTX, { ...REQUEST, to: ' owner@example.test ' });
    sender.failures = 2;

    // Act
    const first = (await delivery.deliver(queue.queued[0] ?? '').catch((e: unknown) => e)) as AuthEmailDeliveryError;
    const second = (await delivery.deliver(queue.queued[1] ?? '').catch((e: unknown) => e)) as AuthEmailDeliveryError;

    // Assert
    expect(first.recipientHash).toBe(second.recipientHash);
  });

  it('fails delivery of an unreadable payload without a kind', async () => {
    const error = (await delivery.deliver('v1.garbage').catch((e: unknown) => e)) as AuthEmailDeliveryError;

    expect(error).toBeInstanceOf(AuthEmailDeliveryError);
    expect(error.kind).toBe('unreadable');
    expect(sender.sent).toHaveLength(0);
  });
});
