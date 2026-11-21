import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { I18nService } from '@vendure/core';

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

/**
 * Vendure gives requests a translator (`req.t`, language from `languageCode` or `Accept-Language`) on its GraphQL
 * paths only. The catalog's REST routes need it too, so a refusal reads in Arabic or English.
 */
@Injectable()
export class RestI18nMiddleware implements NestMiddleware<IncomingMessage, ServerResponse> {
  private readonly handler: Handler;

  constructor(i18n: I18nService) {
    this.handler = i18n.handle() as unknown as Handler;
  }

  use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    this.handler(request, response, next);
  }
}
