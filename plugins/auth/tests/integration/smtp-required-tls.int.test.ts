import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NodemailerEmailSender } from '../../infrastructure/nodemailer-email-sender';
import { mailpitSmtp } from './auth-test-environment';
import { messagesTo } from './mailpit';

/** nodemailer's code for a STARTTLS upgrade the server refused. */
const TLS_UPGRADE_FAILED = 'ETLS';

describe('SMTP with required STARTTLS', () => {
  it('rejects the send to a server that offers no TLS, and delivers nothing', async () => {
    // Arrange: the compose Mailpit speaks plain SMTP only.
    const to = `owner-${randomUUID()}@example.test`;
    const sender = NodemailerEmailSender.connect({ ...mailpitSmtp(), tls: 'starttls' });

    // Act
    const sending = sender.send({
      to,
      subject: 'Required TLS',
      html: '<p>never delivered</p>',
      text: 'never delivered',
    });

    // Assert
    await expect(sending).rejects.toMatchObject({ code: TLS_UPGRADE_FAILED });
    expect(await messagesTo(to)).toEqual([]);
  });
});
