import { describe, expect, it } from 'vitest';
import { InboundWebhookHandlerRegistry } from '../../application/handler-registry';
import { WebhookGatewayService } from '../../application/webhook-gateway.service';

const PROVIDER_LOG_MAX = 40;

function build(): { gateway: WebhookGatewayService; warnings: string[] } {
  const warnings: string[] = [];
  const gateway = new WebhookGatewayService({
    ports: {} as never,
    registry: new InboundWebhookHandlerRegistry(),
    killSwitch: { isEnabled: () => Promise.resolve(true) },
    environment: { logger: { warn: (m: string) => warnings.push(m), error: () => undefined } } as never,
  });
  return { gateway, warnings };
}

const request = { headers: {}, rawBody: Buffer.from('{}'), contentType: 'application/json' };

describe('WebhookGatewayService refusal log', () => {
  it('logs an unknown provider cut to 40 characters on one line', async () => {
    // Arrange
    const { gateway, warnings } = build();
    const provider = `${'x'.repeat(500)}\nforged line`;

    // Act
    const outcome = await gateway.receive(provider, 'acct', request, new Date());

    // Assert
    expect(outcome).toBe('unknown-provider');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain('\n');
    expect(warnings[0]).toContain(JSON.stringify('x'.repeat(PROVIDER_LOG_MAX)));
    expect(warnings[0]?.length).toBeLessThan(200);
  });

  it('escapes control characters in a short provider', async () => {
    // Arrange
    const { gateway, warnings } = build();

    // Act
    await gateway.receive('a\r\nb\u0000', 'acct', request, new Date());

    // Assert
    expect(warnings[0]).toContain(JSON.stringify('a\r\nb\u0000'));
    expect(warnings[0]).not.toContain('\n');
  });
});
