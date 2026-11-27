import { StorefrontStoreRefusedError } from '@cod/plugin-tenancy';
import { type ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { found, StorefrontErrorFilter, StorefrontNotFoundError } from '../../api/error-mapping';

/** Records what the filter wrote. */
function hostRecording(): { host: ArgumentsHost; written: { status?: number; ended: boolean } } {
  const written: { status?: number; ended: boolean } = { ended: false };
  const response = {
    status: (code: number) => {
      written.status = code;
      return {
        end: () => {
          written.ended = true;
        },
      };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { host, written };
}

describe('StorefrontErrorFilter', () => {
  it.each([
    ['not found', new StorefrontNotFoundError(), 404],
    ['a refused store', new StorefrontStoreRefusedError(), 404],
    ['an HTTP refusal', new ForbiddenException('secret detail'), 403],
    ['a server fault holding SQL', new Error('relation "storefront_product" does not exist'), 500],
  ])('answers %s with its status and an empty body', (_label, error, status) => {
    // Arrange
    const { host, written } = hostRecording();

    // Act
    new StorefrontErrorFilter().catch(error, host);

    // Assert
    expect(written).toEqual({ status, ended: true });
  });
});

describe('found', () => {
  it('passes a value through and turns undefined into not found', () => {
    // Act / Assert
    expect(found(0)).toBe(0);
    expect(() => {
      found(undefined);
    }).toThrow(StorefrontNotFoundError);
  });
});
