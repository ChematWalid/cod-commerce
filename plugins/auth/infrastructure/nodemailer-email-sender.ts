import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSenderPort } from '../domain/ports/email-sender.port';

/** Where and as whom the server sends (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`). */
export interface SmtpOptions {
  readonly host: string;
  readonly port: number;
  readonly from: string;
}

/** The implicit-TLS port; every other port starts plain and upgrades with STARTTLS when the server offers it. */
const SMTPS_PORT = 465;
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 30_000;

/** Sends through SMTP with nodemailer (D32). */
export class NodemailerEmailSender implements EmailSenderPort {
  constructor(
    private readonly transport: Pick<Transporter, 'sendMail'>,
    private readonly from: string,
  ) {}

  /** A sender over a new SMTP connection pool-less transport; timeouts keep a dead server from holding a job. */
  static connect(options: SmtpOptions): NodemailerEmailSender {
    const transport = createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === SMTPS_PORT,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
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
