import { RECIPIENT_HASH_DOMAIN, RECIPIENT_HASH_LENGTH } from '../domain/constants';
import { AuthEmailDeliveryError, type AuthEmailRequest, parseAuthEmailRequest } from '../domain/email';
import type { AuthEmailTemplatesPort } from '../domain/ports/auth-email-templates.port';
import type { EmailSenderPort } from '../domain/ports/email-sender.port';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';

const UNKNOWN_REASON = 'unknown';

/** Opens a queued request, renders it and hands it to the mail server: the worker's half of the account emails. */
export class AuthEmailDelivery {
  constructor(
    private readonly sealer: PayloadSealerPort,
    private readonly templates: AuthEmailTemplatesPort,
    private readonly sender: EmailSenderPort,
    private readonly hasher: SecretHasherPort,
  ) {}

  /**
   * @throws AuthEmailDeliveryError carrying the kind, a recipient hash and a short reason; never the address,
   * the variables or the body. The queue retries it.
   */
  async deliver(sealed: string): Promise<void> {
    const request = this.open(sealed);
    try {
      const { subject, html, text } = this.templates.render(request.kind, request.locale, request.vars);
      await this.sender.send({ to: request.to, subject, html, text });
    } catch (error) {
      throw new AuthEmailDeliveryError(request.kind, this.recipientHash(request.to), reasonOf(error));
    }
  }

  /** `unreadable`: not ours or altered. `invalid`: ours, but not a request this version understands. */
  private open(sealed: string): AuthEmailRequest {
    let payload: unknown;
    try {
      payload = this.sealer.open(sealed);
    } catch (error) {
      throw new AuthEmailDeliveryError('unreadable', null, reasonOf(error));
    }
    try {
      return parseAuthEmailRequest(payload);
    } catch (error) {
      throw new AuthEmailDeliveryError('invalid', null, reasonOf(error));
    }
  }

  /** Prefixed, so the hash is not the one the token tables could produce for the same string. */
  private recipientHash(address: string): string {
    return this.hasher.hash(`${RECIPIENT_HASH_DOMAIN}${address.trim().toLowerCase()}`).slice(0, RECIPIENT_HASH_LENGTH);
  }
}

/** The error's code or class name: its message may quote the address or a server reply. */
function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { code } = error as { code?: unknown };
    if (typeof code === 'string') {
      return code;
    }
    return error.constructor.name;
  }
  return UNKNOWN_REASON;
}
