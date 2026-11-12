import { type TenantScope } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { describeFailure } from '../../application/delivery-runner';
import { OutboxService } from '../../application/outbox.service';
import type { OutboxAnnouncerPort, OutboxStorePort } from '../../application/ports';
import { OUTBOX_LAST_ERROR_MAX_LENGTH } from '../../domain/constants';
import { OutboxInputInvalidError } from '../../domain/errors';
import type { OutboxEventInput } from '../../domain/outbox-event';

const scope = {} as TenantScope;
const BIGINT_MAX = '9223372036854775807';

function serviceWithInserts(): { service: OutboxService; inserted: unknown[] } {
  const inserted: unknown[] = [];
  const store = { insertEvent: (_scope: TenantScope, row: unknown) => Promise.resolve(void inserted.push(row)) };
  const announcer: OutboxAnnouncerPort = { announce: () => Promise.resolve() };
  const service = new OutboxService(
    store as unknown as OutboxStorePort,
    announcer,
    { next: () => '1000' },
    { now: () => 0 },
  );
  return { service, inserted };
}

const event = (overrides: Partial<OutboxEventInput> = {}): OutboxEventInput => ({
  topic: 'platform.demo',
  payload: { n: 1 },
  ...overrides,
});

describe('OutboxService.add input checks', () => {
  it.each([
    ['storeId', { storeId: '9999999999999999999' }],
    ['aggregateId', { aggregateId: '9223372036854775808' }],
  ])('rejects a %s above the bigint maximum', async (_field, overrides) => {
    const { service, inserted } = serviceWithInserts();

    await expect(service.add(scope, event(overrides))).rejects.toBeInstanceOf(OutboxInputInvalidError);
    expect(inserted).toEqual([]);
  });

  it('accepts the bigint maximum itself', async () => {
    const { service, inserted } = serviceWithInserts();

    await service.add(scope, event({ storeId: BIGINT_MAX }));

    expect(inserted).toHaveLength(1);
  });

  it.each([['not.registered'], ['x'.repeat(70)]])('rejects the unregistered topic %s', async (topic) => {
    const { service, inserted } = serviceWithInserts();

    await expect(service.add(scope, event({ topic: topic as OutboxEventInput['topic'] }))).rejects.toMatchObject({
      code: 'outbox.input-invalid',
    });
    expect(inserted).toEqual([]);
  });
});

describe('describeFailure', () => {
  it('keeps the error class name and code, never the message', () => {
    class LeakyError extends Error {}

    const text = describeFailure(new LeakyError('Key (email)=(a@b.c) already exists'));

    expect(text).toBe('LeakyError (unexpected)');
  });

  it('cuts the text to the column', () => {
    class Long extends Error {}
    Object.defineProperty(Long, 'name', { value: 'L'.repeat(OUTBOX_LAST_ERROR_MAX_LENGTH + 100) });

    expect(describeFailure(new Long('x'))).toHaveLength(OUTBOX_LAST_ERROR_MAX_LENGTH);
  });
});
