import { EventBus, JobQueueService, Logger } from '@vendure/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthEmailDelivery } from '../../application/auth-email-delivery';
import type { PasswordResetService } from '../../application/password-reset.service';
import { AUTH_EMAIL_ATTEMPTS } from '../../domain/constants';
import {
  AuthEmailJobs,
  AuthEmailRequestedEvent,
  PasswordResetRequestedEvent,
} from '../../infrastructure/auth-email-queue';

const SEALED = 'v1.sealed-payload-without-any-address';
const FAILURE = 'ECONNRESET';

type Process = (job: { data: { sealed: string; resetRequest?: true } }) => Promise<void>;
type Event = AuthEmailRequestedEvent | PasswordResetRequestedEvent;

/** The event bus and job queue the jobs class talks to, reduced to what it uses. */
function harness(options: { readonly queueFails?: boolean } = {}) {
  const listeners: ((event: Event) => void)[] = [];
  const events = {
    next: (event: Event): void => {
      listeners.forEach((listener) => {
        listener(event);
      });
    },
  };
  const added: { data: unknown; options: unknown }[] = [];
  let process: Process = () => Promise.reject(new Error('queue not created'));
  const eventBus = {
    ofType: (type: new (...args: never[]) => Event) => ({
      subscribe: (next: (event: Event) => void) => {
        listeners.push((event) => {
          if (event instanceof type) {
            next(event);
          }
        });
      },
    }),
  } as unknown as EventBus;
  const jobQueues = {
    createQueue: (config: { process: Process }) => {
      process = config.process;
      return Promise.resolve({
        add: (data: unknown, addOptions: unknown) => {
          if (options.queueFails === true) {
            return Promise.reject(new Error(FAILURE));
          }
          added.push({ data, options: addOptions });
          return Promise.resolve({});
        },
      });
    },
  } as unknown as JobQueueService;
  const delivery = { deliver: vi.fn(() => Promise.resolve()) };
  const resets = { fulfil: vi.fn(() => Promise.resolve()) };
  const jobs = new AuthEmailJobs(
    jobQueues,
    eventBus,
    delivery as unknown as AuthEmailDelivery,
    resets as unknown as PasswordResetService,
  );
  return { jobs, events, added, resets, delivery, run: (data: Parameters<Process>[0]['data']) => process({ data }) };
}

const ctx = {} as never;
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('AuthEmailJobs', () => {
  let errors: string[];

  beforeEach(() => {
    errors = [];
    vi.spyOn(Logger, 'error').mockImplementation((message: string) => {
      errors.push(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs an error carrying the kind when the queue is missing, and throws nothing', async () => {
    // Arrange
    const { jobs, events } = harness();
    // The state the class guards against: an event arrives while no queue handle is held.
    await jobs.onModuleInit();
    (jobs as unknown as { queue: undefined }).queue = undefined;

    // Act
    events.next(new AuthEmailRequestedEvent(ctx, SEALED, 'verification'));
    await settle();

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('could not be queued');
    expect(errors[0]).toContain('kind=verification');
    expect(errors[0]).not.toContain(SEALED);
  });

  it('logs the kind when adding to the queue fails', async () => {
    // Arrange
    const { jobs, events } = harness({ queueFails: true });
    await jobs.onModuleInit();

    // Act
    events.next(new AuthEmailRequestedEvent(ctx, SEALED, 'password-changed'));
    await settle();

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('kind=password-changed');
  });

  it('queues a forgot-password request as exactly {sealed, resetRequest}, with the retry budget', async () => {
    // Arrange
    const { jobs, events, added } = harness();
    await jobs.onModuleInit();

    // Act
    events.next(new PasswordResetRequestedEvent(ctx, SEALED));
    await settle();

    // Assert
    expect(added).toEqual([
      { data: { sealed: SEALED, resetRequest: true }, options: { retries: AUTH_EMAIL_ATTEMPTS - 1 } },
    ]);
  });

  it('queues a delivery request as {sealed} alone', async () => {
    // Arrange
    const { jobs, events, added } = harness();
    await jobs.onModuleInit();

    // Act
    events.next(new AuthEmailRequestedEvent(ctx, SEALED, 'verification'));
    await settle();

    // Assert
    expect(added.map((entry) => entry.data)).toEqual([{ sealed: SEALED }]);
  });

  it('logs no email and no address when fulfilReset fails, and rethrows so the queue retries', async () => {
    // Arrange
    const { jobs, resets, run } = harness();
    await jobs.onModuleInit();
    resets.fulfil.mockRejectedValueOnce(
      Object.assign(new Error('lookup of owner@example.test failed'), { name: 'LookupError' }),
    );

    // Act
    const outcome = await run({ sealed: SEALED, resetRequest: true }).catch((caught: unknown) => caught);

    // Assert
    expect((outcome as Error).name).toBe('LookupError');
    expect(errors).toEqual(['Password reset request failed: reason=LookupError']);
    expect(errors.join(' ')).not.toContain('example.test');
    expect(errors.join(' ')).not.toContain(SEALED);
  });
});
