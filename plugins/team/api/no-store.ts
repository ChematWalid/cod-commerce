import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';

/** Headers of every invitation answer: a token page is never cached, nor its address sent on as a referrer (D205). */
const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

/** Sets the D205 headers on a response. */
export function noStoreHeaders(res: Pick<ServerResponse, 'setHeader'>): void {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) res.setHeader(name, value);
}

/** For the public invitation routes. Nest runs middleware before guards, so a 429 carries the headers too. */
@Injectable()
export class NoStoreMiddleware implements NestMiddleware<IncomingMessage, ServerResponse> {
  use(_request: IncomingMessage, response: ServerResponse, next: () => void): void {
    noStoreHeaders(response);
    next();
  }
}
