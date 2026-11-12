import { Controller, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import type { Request, Response } from 'express';
import { WebhookGatewayService } from '../application/webhook-gateway.service';
import { WEBHOOK_RETRY_AFTER_SECONDS } from '../domain/constants';
import type { GatewayOutcome } from '../domain/gateway-outcome';
import type { WebhookRequest } from '../domain/inbound-webhook-handler';

const STATUS: Readonly<Record<GatewayOutcome, number>> = {
  accepted: 200,
  duplicate: 200,
  disabled: 503,
  'unknown-provider': 404,
  'unknown-account': 404,
  'bad-signature': 401,
};

function headersOf(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
  }
  return headers;
}

/**
 * `POST /webhooks/:provider/:accountKey` (D109). The route is public in Vendure's sense because the provider's
 * signature is its authentication; the gateway checks it before anything is stored.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(@Inject(WebhookGatewayService) private readonly gateway: WebhookGatewayService) {}

  @Post(':provider/:accountKey')
  @Allow(Permission.Public)
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Param('accountKey') accountKey: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'accepted' } | undefined> {
    const request: WebhookRequest = {
      headers: headersOf(req),
      // The raw-body middleware of this plugin put the bytes here; anything else means there is no body.
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      contentType: req.headers['content-type'] ?? '',
    };
    const outcome = await this.gateway.receive(provider, accountKey, request, new Date());
    res.status(STATUS[outcome]);
    if (outcome === 'disabled') res.setHeader('Retry-After', String(WEBHOOK_RETRY_AFTER_SECONDS));
    return STATUS[outcome] === 200 ? { status: 'accepted' } : undefined;
  }
}
