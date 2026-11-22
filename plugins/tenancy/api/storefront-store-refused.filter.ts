import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';

/** A storefront call with no signed, active store: answered 404 with an empty body (D3201). */
export class StorefrontStoreRefusedError extends Error {
  constructor() {
    super('storefront store refused');
    this.name = 'StorefrontStoreRefusedError';
  }
}

/**
 * Answers a {@link StorefrontStoreRefusedError} like the internal-only middleware answers a bad signature: 404 and an
 * empty body, so a caller cannot tell an unknown store from an archived one or a missing signature (D112).
 */
/** The part of the HTTP response the filter writes. */
interface RefusalResponse {
  status(code: number): { end(): void };
}

@Catch(StorefrontStoreRefusedError)
export class StorefrontStoreRefusedFilter implements ExceptionFilter<StorefrontStoreRefusedError> {
  catch(_error: StorefrontStoreRefusedError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<RefusalResponse>().status(HttpStatus.NOT_FOUND).end();
  }
}
