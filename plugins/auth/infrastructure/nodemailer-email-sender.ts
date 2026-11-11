import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSenderPort } from '../domain/ports/email-sender.port';
import { smtpTransportOptions, type SmtpOptions } from './smtp-transport-options';

/** Sends through SMTP with nodemailer (D32). */
export class NodemailerEmailSender implements EmailSenderPort {
  constructor(
    private readonly transport: Pick<Transporter, 'sendMail'>,
    private readonly from: string,
  ) {}

  /** A sender over a new pool-less SMTP transport, signed in and encrypted as `options` says. */
  static connect(options: SmtpOptions): NodemailerEmailSender {
    const transport = createTransport(smtpTransportOptions(options));
    return new NodemailerEmailSender(transport, options.from);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
