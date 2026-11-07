import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Logger } from '@vendure/core';
import type { LivenessService } from '../application/liveness.service';
import type { ReadinessService } from '../application/readiness.service';
import {
  HEALTH_HTTP_STATUS,
  HEALTH_PATHS,
  HTTP_INTERNAL_ERROR,
  HTTP_NOT_FOUND,
  LOGGER_CONTEXT,
} from '../domain/constants';

/** What the worker health server answers with. */
export interface WorkerHealthServerOptions {
  /** The port to listen on; 0 picks a free one. */
  readonly port: number;
  readonly readiness: ReadinessService;
  readonly liveness: LivenessService;
}

/** A running worker health server. */
export interface WorkerHealthServer {
  /** The port it actually listens on. */
  readonly port: number;
  close(): Promise<void>;
}

interface PlainResponse {
  readonly statusCode: number;
  readonly body?: unknown;
}

const pathOf = (url: string | undefined): string => (url ?? '').split('?')[0] ?? '';

async function respond(path: string, options: WorkerHealthServerOptions): Promise<PlainResponse> {
  if (path === HEALTH_PATHS.ready) {
    const report = await options.readiness.check();
    return { statusCode: HEALTH_HTTP_STATUS[report.status], body: report };
  }
  if (path === HEALTH_PATHS.live) {
    const report = options.liveness.check();
    return { statusCode: HEALTH_HTTP_STATUS[report.status], body: report };
  }
  return { statusCode: HTTP_NOT_FOUND };
}

function send(response: ServerResponse, { statusCode, body }: PlainResponse): void {
  response.statusCode = statusCode;
  if (body === undefined) {
    response.end();
    return;
  }
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
}

function handle(request: IncomingMessage, response: ServerResponse, options: WorkerHealthServerOptions): void {
  respond(pathOf(request.url), options).then(
    (answer) => {
      send(response, answer);
    },
    (error: unknown) => {
      const trace = error instanceof Error ? error.stack : String(error);
      Logger.error(`Worker health endpoint ${pathOf(request.url)} failed`, LOGGER_CONTEXT, trace);
      send(response, { statusCode: HTTP_INTERNAL_ERROR });
    },
  );
}

const listen = (server: Server, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve();
    });
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    // Probe clients may keep their connection alive; an idle one must not hold the shutdown open.
    server.closeIdleConnections();
  });

/**
 * Serves `/livez` and `/readyz` on their own port, for the worker role, which has no HTTP server of its own.
 * Every other path answers 404.
 */
export async function startWorkerHealthServer(options: WorkerHealthServerOptions): Promise<WorkerHealthServer> {
  const server = createServer((request, response) => {
    handle(request, response, options);
  });
  await listen(server, options.port);
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : options.port;
  return { port, close: () => closeServer(server) };
}
