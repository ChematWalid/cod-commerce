import { describe, expect, it } from 'vitest';
import { smtpTransportOptions, type SmtpOptions } from '../../infrastructure/smtp-transport-options';

const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 };
const CREDENTIALS = { user: 'user@example.test', pass: 'not-a-real-password' };

describe('smtpTransportOptions', () => {
  it('connects to Mailpit in plain SMTP without credentials', () => {
    // Arrange
    const mailpit: SmtpOptions = { host: 'localhost', port: 1026, from: 'no-reply@localhost', tls: 'none' };

    // Act
    const options = smtpTransportOptions(mailpit);

    // Assert
    expect(options).toEqual({ host: 'localhost', port: 1026, secure: false, ...TIMEOUTS });
  });

  it('requires STARTTLS and authenticates on a submission port', () => {
    // Arrange
    const gmail: SmtpOptions = {
      host: 'smtp.gmail.com',
      port: 587,
      from: CREDENTIALS.user,
      tls: 'starttls',
      auth: CREDENTIALS,
    };

    // Act
    const options = smtpTransportOptions(gmail);

    // Assert
    expect(options).toEqual({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: CREDENTIALS,
      ...TIMEOUTS,
    });
  });

  it('opens the connection in TLS and authenticates with implicit TLS', () => {
    // Arrange
    const smtps: SmtpOptions = {
      host: 'smtp.gmail.com',
      port: 465,
      from: CREDENTIALS.user,
      tls: 'implicit',
      auth: CREDENTIALS,
    };

    // Act
    const options = smtpTransportOptions(smtps);

    // Assert
    expect(options).toEqual({ host: 'smtp.gmail.com', port: 465, secure: true, auth: CREDENTIALS, ...TIMEOUTS });
  });

  it('follows the TLS mode, not the port number', () => {
    expect(
      smtpTransportOptions({ host: 'relay.example.test', port: 465, from: 'a@example.test', tls: 'none' }),
    ).toMatchObject({ secure: false });
    expect(
      smtpTransportOptions({ host: 'relay.example.test', port: 2465, from: 'a@example.test', tls: 'implicit' }),
    ).toMatchObject({ secure: true });
  });
});
