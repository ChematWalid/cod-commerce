import { DomainError } from '@cod/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService, Logger, parseContext } from '@vendure/core';
import { INTERNAL_MESSAGE, pathOf, TeamRestErrorFilter } from './error-mapping';
import { noStoreHeaders } from './no-store';

const LOG_CONTEXT = 'TeamApi';
/** The lowest status that is a fault of the server rather than a refusal of the request. */
const SERVER_FAULT_FLOOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Every error of the public invitation routes, whose query carries the raw token (D205). A domain error gets Team's
 * REST mapping; anything else a generic answer with the path only, where Vendure's own filter would echo the URL.
 * Rate-limit refusals are answered before this by `@RateLimit`'s method-level filter.
 */
@Injectable()
@Catch()
export class TeamPublicRestFilter implements ExceptionFilter {
  private readonly domainErrors = new TeamRestErrorFilter();

  constructor(private readonly config: ConfigService) {}

  catch(error: unknown, host: ArgumentsHost): void {
    if (error instanceof DomainError) {
      this.domainErrors.catch(error, host);
      return;
    }
    const status: number = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    this.report(error, host, status >= SERVER_FAULT_FLOOR);
    const { req, res } = parseContext(host);
    noStoreHeaders(res);
    res.status(status).json({ statusCode: status, message: INTERNAL_MESSAGE, path: pathOf(req.url) });
  }

  /** Logs a server fault, never the URL, and hands every error to Vendure's error handlers as its own filter does. */
  private report(thrown: unknown, host: ArgumentsHost, serverFault: boolean): void {
    const error = thrown instanceof Error ? thrown : new Error(`Non-error thrown: ${typeof thrown}`);
    for (const handler of this.config.systemOptions.errorHandlers) void handler.handleServerError(error, { host });
    if (!serverFault) return;
    Logger.error(`Invitation route fault: ${error.name}`, LOG_CONTEXT, error.stack);
  }
}
