import { DomainError, GEO_ERROR_CODES } from '@cod/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { type I18nRequest, Logger, parseContext } from '@vendure/core';
import { GEO_LOG_CONTEXT } from '../domain/constants';

/** What a client reads for a fault of the server: never SQL, an entity name or a stack. */
export const INTERNAL_MESSAGE = 'The request could not be completed';

/** The HTTP status of every geo code; both are a 404, whatever was wrong with the parameter. */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [GEO_ERROR_CODES.PROVINCE_NOT_FOUND, HttpStatus.NOT_FOUND],
  [GEO_ERROR_CODES.STORE_NOT_FOUND, HttpStatus.NOT_FOUND],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The path without its query string, which may carry a store id. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/**
 * Runs a REST handler body with the geo mapping (§3a.8): a domain error reaches {@link GeoRestErrorFilter}, an HTTP
 * exception stays itself, and anything else is a fault, logged with its type only and answered as a bare 500.
 */
export async function geoRestCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof DomainError || thrown instanceof HttpException) throw thrown;
    const fault = thrown instanceof Error ? thrown : new Error(`Non-error thrown: ${typeof thrown}`);
    Logger.error(`Geo fault: ${fault.name}`, GEO_LOG_CONTEXT, fault.stack);
    throw new InternalServerErrorException(INTERNAL_MESSAGE);
  }
}

/** The REST answer of a domain error: its status, its stable code and the translated message (the offers' envelope). */
@Catch(DomainError)
export class GeoRestErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const status = STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const internal = status === HttpStatus.INTERNAL_SERVER_ERROR;
    if (internal) Logger.error(`Domain error with no REST status: ${error.code}`, GEO_LOG_CONTEXT);
    res.status(status).json({
      statusCode: status,
      code: error.code,
      message: internal
        ? INTERNAL_MESSAGE
        : ((req as Partial<I18nRequest>).t?.(messageKeyOf(error.code)) ?? error.code),
      path: pathOf(req.url),
    });
  }
}
