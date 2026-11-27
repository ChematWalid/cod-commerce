import type { ServerResponse } from 'node:http';
import { type CallHandler, type ExecutionContext, type NestInterceptor, UseInterceptors } from '@nestjs/common';
import { PROVINCES_MAX_AGE_SECONDS, PROVINCES_STALE_WHILE_REVALIDATE_SECONDS } from '../domain/constants';

/** The public wilaya data: the same for every buyer, cacheable by browsers and CDNs (D3117). */
export const PUBLIC_REFERENCE_CACHE_CONTROL = `public, max-age=${String(PROVINCES_MAX_AGE_SECONDS)}, stale-while-revalidate=${String(PROVINCES_STALE_WHILE_REVALIDATE_SECONDS)}`;

/** A store's narrowed wilaya: never stored, so a store's fee table never leaks through a shared cache (D3106). */
export const PRIVATE_NO_STORE_CACHE_CONTROL = 'private, no-store';

/**
 * Sets `Cache-Control` before the handler runs, so its answer and its refusal (a 404) carry the same header: it
 * depends on the route only (D3117). An interceptor runs after the guards, so a 429 of the rate limiter never gets a
 * public cache header that a CDN would serve to every buyer. Given as an instance, so Nest never injects it.
 */
class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly value: string) {}

  intercept(context: ExecutionContext, next: CallHandler): ReturnType<CallHandler['handle']> {
    context.switchToHttp().getResponse<ServerResponse>().setHeader('Cache-Control', this.value);
    return next.handle();
  }
}

/** Gives every handler of a controller the `Cache-Control` header `value`. */
export const CacheControl = (value: string): ClassDecorator & MethodDecorator =>
  UseInterceptors(new CacheControlInterceptor(value));
