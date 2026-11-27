import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { I18nService } from '@vendure/core';

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

/**
 * Vendure gives requests a translator (`req.t`) on its GraphQL paths only; the provinces routes need it too, so a
 * refusal reads in Arabic or English (copy of the offers' middleware, D2520).
 */
@Injectable()
export class GeoRestI18nMiddleware implements NestMiddleware<IncomingMessage, ServerResponse> {
  private readonly handler: Handler;

  constructor(i18n: I18nService) {
    this.handler = i18n.handle() as unknown as Handler;
  }

  use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    this.handler(request, response, next);
  }
}
