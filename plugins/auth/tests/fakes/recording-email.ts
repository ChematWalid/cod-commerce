import type { AuthEmailTemplatesPort } from '../../domain/ports/auth-email-templates.port';
import type { EmailMessage, EmailSenderPort } from '../../domain/ports/email-sender.port';
import type { AuthEmailQueuePort } from '../../domain/ports/auth-email-queue.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { AuthEmailKind, AuthEmailLocale, AuthEmailVars, RenderedEmail } from '../../domain/email';

/** Templates that put every variable in the text, so a test can see what reached the renderer. */
export class EchoTemplates implements AuthEmailTemplatesPort {
  render(kind: AuthEmailKind, locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
    const body = Object.entries(vars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    return { subject: `${kind}/${locale}`, html: `<p>${body}</p>`, text: body };
  }
}

/** A sender that keeps what it is given, or fails the first `failures` times. */
export class RecordingSender implements EmailSenderPort {
  readonly sent: EmailMessage[] = [];
  failures = 0;

  send(message: EmailMessage): Promise<void> {
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(Object.assign(new Error(`550 mailbox ${message.to} unavailable`), { code: 'EENVELOPE' }));
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}

/** A queue that keeps the sealed payloads it is given. */
export class RecordingQueue implements AuthEmailQueuePort {
  readonly queued: string[] = [];

  enqueue(_ctx: OperationContext, sealed: string): Promise<void> {
    this.queued.push(sealed);
    return Promise.resolve();
  }
}
