/** A local HTTP stub for the link scraper's tests (D2214): routes per test, every request recorded. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Handler = (request: IncomingMessage, response: ServerResponse) => void;

export const HOST = 'shop.example.com';
export const LOOPBACK = '127.0.0.1';
export const page = (title: string): string =>
  `<!doctype html><html><head><meta property="og:title" content="${title}"></head><body></body></html>`;

/** A local stub server whose routes each test sets; it records every request it gets. */
export class StubServer {
  readonly seen: IncomingMessage[] = [];
  routes = new Map<string, Handler>();
  private readonly server: Server = createServer((request, response) => {
    this.seen.push(request);
    const handler = this.routes.get(request.url ?? '');
    if (handler === undefined) {
      response.writeHead(404).end();
      return;
    }
    handler(request, response);
  });

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, LOOPBACK, resolve));
  }

  get port(): number {
    return (this.server.address() as AddressInfo).port;
  }

  url(path: string, host = HOST): string {
    return `http://${host}:${String(this.port)}${path}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}

export const html =
  (body: string): Handler =>
  (_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  };
export const redirect =
  (location: string): Handler =>
  (_request, response) => {
    response.writeHead(302, { location }).end();
  };

/** Every host is the stub's loopback address: the vetting is the test's to inject (D2214). */
