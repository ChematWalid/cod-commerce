import { type AuthEmailRequest, parseAuthEmailRequest } from '../domain/email';
import type { AuthEmailQueuePort } from '../domain/ports/auth-email-queue.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';

/** Asks for an account email; the worker sends it (D32). */
export class AuthEmailService {
  constructor(
    private readonly queue: AuthEmailQueuePort,
    private readonly sealer: PayloadSealerPort,
  ) {}

  /**
   * Seals the request, so no link, code or address sits readable in the queue store, and queues it after the
   * transaction in `ctx` commits. Nothing is queued if that transaction rolls back.
   *
   * @throws InvalidAuthEmailRequestError for an unknown kind or locale or a missing variable.
   */
  async enqueue(ctx: OperationContext, request: AuthEmailRequest): Promise<void> {
    const checked = parseAuthEmailRequest(request);
    await this.queue.enqueue(ctx, this.sealer.seal(checked), checked.kind);
  }
}
