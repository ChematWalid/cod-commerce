import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { LivenessService } from '../application/liveness.service';
import { ReadinessService } from '../application/readiness.service';
import { HEALTH_PATHS } from '../domain/constants';
import { toHealthResponse, type HealthResponse } from './health-response';

/** Express sets `originalUrl`; Nest may mount the middleware with `req.url` relative to its route. */
type HealthRequest = IncomingMessage & { readonly originalUrl?: string };

const pathOf = (request: HealthRequest): string => (request.originalUrl ?? request.url ?? '').split('?')[0] ?? '';

/**
 * Answers `/livez` and `/readyz` on the api port. Nest runs middleware before guards, so the probes never
 * reach Vendure's AuthGuard and need no session or channel token.
 */
@Injectable()
export class HealthMiddleware implements NestMiddleware<HealthRequest, ServerResponse> {
  constructor(
    private readonly readiness: ReadinessService,
    private readonly liveness: LivenessService,
  ) {}

  async use(request: HealthRequest, response: ServerResponse, next: () => void): Promise<void> {
    const answer = await this.answer(pathOf(request));
    if (answer === undefined) {
      next();
      return;
    }
    response.statusCode = answer.statusCode;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(answer.body));
  }

  private async answer(path: string): Promise<HealthResponse<string> | undefined> {
    if (path === HEALTH_PATHS.ready) {
      return toHealthResponse(await this.readiness.check());
    }
    if (path === HEALTH_PATHS.live) {
      return toHealthResponse(this.liveness.check());
    }
    return undefined;
  }
}
