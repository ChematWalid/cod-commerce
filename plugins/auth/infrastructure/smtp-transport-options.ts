/**
 * How the connection to the SMTP server is protected (`SMTP_TLS`):
 * - `none`: TLS not required (the connection still upgrades if the server offers STARTTLS), which is how the local Mailpit is reached;
 * - `starttls`: starts plain and must upgrade with STARTTLS, or the send fails (port 587);
 * - `implicit`: TLS from the first byte (port 465).
 */
export type SmtpTlsMode = 'none' | 'starttls' | 'implicit';

/** The account the server signs in to the SMTP relay with (`SMTP_USERNAME`, `SMTP_PASSWORD`). */
export interface SmtpCredentials {
  readonly user: string;
  readonly pass: string;
}

/** Where, how and as whom the server sends (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_TLS` and the credentials). */
export interface SmtpOptions {
  readonly host: string;
  readonly port: number;
  readonly from: string;
  readonly tls: SmtpTlsMode;
  /** Absent for a relay that takes mail without signing in, such as Mailpit. */
  readonly auth?: SmtpCredentials;
}

/** The nodemailer settings of one {@link SmtpTlsMode}. */
interface TlsTransportOptions {
  readonly secure: boolean;
  readonly requireTLS?: true;
}

/** What {@link smtpTransportOptions} hands to nodemailer's `createTransport`. */
export interface SmtpTransportOptions extends TlsTransportOptions {
  readonly host: string;
  readonly port: number;
  readonly auth?: SmtpCredentials;
  readonly connectionTimeout: number;
  readonly greetingTimeout: number;
  readonly socketTimeout: number;
}

/** `requireTLS` is what forbids a silent downgrade: without it nodemailer sends in clear when STARTTLS is not offered. */
const TLS_TRANSPORT_OPTIONS: Readonly<Record<SmtpTlsMode, TlsTransportOptions>> = {
  none: { secure: false },
  starttls: { secure: false, requireTLS: true },
  implicit: { secure: true },
};

const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 30_000;

/** The nodemailer transport settings for `options`; the timeouts keep a dead server from holding a job. */
export function smtpTransportOptions(options: SmtpOptions): SmtpTransportOptions {
  return {
    host: options.host,
    port: options.port,
    ...TLS_TRANSPORT_OPTIONS[options.tls],
    ...(options.auth === undefined ? {} : { auth: options.auth }),
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  };
}
